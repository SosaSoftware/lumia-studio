import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { StrandsAgent } from '@ag-ui/aws-strands';
import { EventType } from '@ag-ui/core';
import type { BaseEvent, RunAgentInput } from '@ag-ui/core';
import { RunAgentInputSchema } from '@ag-ui/core/schemas';
import { EventEncoder } from '@ag-ui/encoder';
import { Agent } from '@strands-agents/sdk';
import express from 'express';
import type { ErrorRequestHandler, Express, NextFunction, Request, Response } from 'express';
import type { Caller, IdentityResolver } from '../identity/caller.ts';
import { UnauthenticatedError } from '../identity/caller.ts';
import { StudioUnavailableError } from '../mcp/studio-mcp-connector.ts';
import { LibraryLogBridge } from '../shared/library-log-bridge.ts';
import type { Logger } from '../shared/logger.ts';
import type { InputGuard } from './input-guard.ts';
import { InputRejectedError } from './input-guard.ts';
import { ThreadCapacityError } from './thread-registry.ts';
import type { ThreadLease, ThreadRegistry } from './thread-registry.ts';
import { UnreachableModel } from './unreachable-model.ts';

/** Paths of the AgentCore Runtime contract for AG-UI agents. */
export const INVOCATIONS_PATH = '/invocations';
export const PING_PATH = '/ping';

const BEARER = /^Bearer[ \t]+(\S+)$/i;
/** Thread ids of the web are UUIDs; AgentCore session ids are 33 to 128 characters of this alphabet. */
const THREAD_ID = /^[A-Za-z0-9_-]{8,128}$/;
/** The web sends the history it holds; the adapter's snapshots keep it to the current turn. */
const BODY_LIMIT = '10mb';
const PROTOBUF_MEDIA_TYPE = 'application/vnd.ag-ui.event+proto';
/** Seconds that a stopping server waits for running turns before closing their connections. */
const DRAIN_TIMEOUT_MS = 25_000;

/**
 * What the browser reads when a turn fails. Errors of the model or of AWS can name accounts, roles or internal
 * ids, so their text stays in the server log and only the code reaches the browser.
 */
const RUN_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  THREAD_BUSY: 'Lumi is still working on the previous message of this conversation.',
};
const RUN_ERROR_MESSAGE = 'Lumi could not finish this turn.';

export interface AguiServerOptions {
  /** AG-UI agent name. */
  readonly name: string;
  readonly description: string;
  readonly identity: IdentityResolver;
  readonly registry: ThreadRegistry;
  readonly guard: InputGuard;
  readonly logger: Logger;
}

/** An HTTP error answered as `{ error: { code, message } }`. */
class HttpError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * The HTTP face of Lumi, the same locally and in AgentCore Runtime: `POST /invocations` streams AG-UI events and
 * `GET /ping` reports health.
 *
 * A run goes through these steps: the bearer token is resolved to the person before the body is read; the body
 * must be a valid `RunAgentInput`; the agent of that person's conversation is lent by the registry; the input
 * guard keeps only what the browser may say; and `@ag-ui/aws-strands` runs the turn under the person's thread
 * key while this server writes the events, with the browser's own thread id, as SSE (or protobuf when asked).
 */
export class AguiServer {
  public readonly app: Express;
  private readonly adapter: StrandsAgent;
  private readonly callers = new WeakMap<Request, Caller>();
  private readonly running = new Set<Promise<void>>();
  private server: Server | undefined;

  public constructor(private readonly options: AguiServerOptions) {
    this.adapter = new StrandsAgent({
      agent: new Agent({ name: options.name, model: new UnreachableModel(), printer: false, tools: [] }),
      name: options.name,
      description: options.description,
      config: { logger: new LibraryLogBridge(options.logger.child({ component: 'ag-ui' })) },
      agentsByThread: options.registry.agentsByThread,
    });
    this.app = this.buildApp();
  }

  /** Starts listening and returns the bound port (useful with port 0). */
  public listen(port: number, host: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = this.app.listen(port, host, (error?: Error) => {
        if (error !== undefined) {
          reject(error);
          return;
        }
        const address = server.address();
        // A TCP server always reports an AddressInfo once it listens.
        resolve((address as AddressInfo).port);
      });
      this.server = server;
    });
  }

  /** Stops accepting requests, lets running turns finish for a while, then releases every agent. */
  public async close(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    if (server !== undefined) {
      const closed = new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error === undefined) {
            resolve();
          } else {
            reject(error);
          }
        });
      });
      server.closeIdleConnections();
      const drained = await Promise.race([
        Promise.allSettled(this.running).then(() => true),
        new Promise<boolean>((resolve) => setTimeout(resolve, DRAIN_TIMEOUT_MS, false).unref()),
      ]);
      if (!drained) {
        this.options.logger.warn('Closing connections of turns still running');
      }
      server.closeAllConnections();
      await closed;
    }
    await this.options.registry.close();
  }

  private buildApp(): Express {
    const app = express();
    app.disable('x-powered-by');
    app.get(PING_PATH, (_req, res) => {
      // Without `time_of_last_update`, AgentCore tracks status changes itself and idle sessions can end.
      res.json({ status: this.options.registry.busy ? 'HealthyBusy' : 'Healthy' });
    });
    app.post(
      INVOCATIONS_PATH,
      (req, res, next) => this.authenticate(req, next),
      (req, _res, next) => {
        next(req.is(['application/json', '+json']) === false ? new HttpError(415, 'unsupported_media_type', 'The body must be JSON.') : undefined);
      },
      express.json({ limit: BODY_LIMIT, type: ['application/json', '+json'] }),
      (req, res) => this.track(this.invoke(req, res)),
    );
    app.use((_req, _res, next) => {
      next(new HttpError(404, 'not_found', 'Route not found.'));
    });
    app.use(this.errorHandler());
    return app;
  }

  private async authenticate(req: Request, next: NextFunction): Promise<void> {
    const token = BEARER.exec(req.header('authorization') ?? '')?.[1];
    if (token === undefined) {
      next(new HttpError(401, 'unauthenticated', 'A bearer token is required.'));
      return;
    }
    try {
      this.callers.set(req, await this.options.identity.resolve(token));
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        this.options.logger.info('Request without a valid token', { reason: error.message });
        next(new HttpError(401, 'unauthenticated', 'The session is not valid or expired.'));
        return;
      }
      next(error);
      return;
    }
    next();
  }

  /** Remembers a running turn, so a stopping server can wait for it. */
  private async track(turn: Promise<void>): Promise<void> {
    this.running.add(turn);
    try {
      await turn;
    } finally {
      this.running.delete(turn);
    }
  }

  private async invoke(req: Request, res: Response): Promise<void> {
    const caller = this.callers.get(req);
    if (caller === undefined) {
      throw new HttpError(401, 'unauthenticated', 'A bearer token is required.');
    }
    const parsed = RunAgentInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'invalid_input', 'The body is not a valid RunAgentInput.');
    }
    const input = parsed.data;
    if (!THREAD_ID.test(input.threadId)) {
      throw new HttpError(400, 'invalid_thread', 'threadId must have 8 to 128 letters, digits, "-" or "_".');
    }
    const lease = await this.lease(caller, input.threadId);
    try {
      const guarded = this.options.guard.guard(input, lease.threadKey, lease.thread.pendingFrontendCalls());
      this.options.logger.info('Turn started', { threadKey: lease.threadKey, runId: input.runId, kind: guarded.kind });
      await this.stream(req, res, guarded.input, input.threadId);
    } catch (error) {
      if (error instanceof InputRejectedError) {
        throw new HttpError(error.status, 'invalid_input', error.message);
      }
      throw error;
    } finally {
      lease.release();
    }
  }

  private async lease(caller: Caller, threadId: string): Promise<ThreadLease> {
    try {
      return await this.options.registry.acquire(caller, threadId);
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        this.options.logger.warn('Studio rejected the session', { reason: error.message });
        throw new HttpError(401, 'unauthenticated', 'Studio rejected the session.');
      }
      if (error instanceof StudioUnavailableError || error instanceof ThreadCapacityError) {
        this.options.logger.warn('Conversation agent unavailable', { reason: error.message, cause: error.cause });
        throw new HttpError(503, 'unavailable', 'Lumi cannot reach Lumia Studio right now.');
      }
      throw error;
    }
  }

  /** Runs the turn and writes its events until it ends or the browser goes away. */
  private async stream(req: Request, res: Response, input: RunAgentInput, threadId: string): Promise<void> {
    const accept = req.header('accept');
    const protobuf = accept?.split(',').some((type) => type.split(';')[0]?.trim().toLowerCase() === PROTOBUF_MEDIA_TYPE) === true;
    const encoder = new EventEncoder({ accept: protobuf ? accept : 'text/event-stream' });
    const contentType = encoder.getContentType();
    res.status(200);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const write = (event: BaseEvent): void => {
      if (!res.writableEnded && !res.destroyed) {
        res.write(contentType === 'text/event-stream' ? encoder.encode(event) : Buffer.from(encoder.encodeBinary(event)));
      }
    };
    const events = this.adapter.run(input);
    const disconnected = new AbortController();
    const onClose = (): void => {
      disconnected.abort();
      // Ends the run as soon as the browser leaves; the adapter frees the thread in its `finally`.
      events.return(undefined).catch((error: unknown) => {
        this.options.logger.warn('Ending an abandoned turn failed', { error });
      });
    };
    res.once('close', onClose);
    try {
      for (;;) {
        let next: IteratorResult<BaseEvent>;
        try {
          next = await events.next();
        } catch (error) {
          this.options.logger.error('Turn failed', { error });
          write({ type: EventType.RUN_ERROR, message: 'Lumi could not finish this turn.', code: 'LUMI_ERROR' });
          break;
        }
        if (next.done === true || disconnected.signal.aborted) {
          break;
        }
        write(this.forBrowser(next.value, input.threadId, threadId));
      }
    } finally {
      res.removeListener('close', onClose);
      try {
        await events.return(undefined);
      } catch (error) {
        this.options.logger.warn('Ending the turn failed', { error });
      }
      if (!res.writableEnded) {
        res.end();
      }
    }
  }

  /**
   * An event as the browser receives it: with the browser's own thread id instead of the thread key the adapter ran
   * under, and, for a failed run, with the code but not the text of the error, which goes to the log.
   */
  private forBrowser(event: BaseEvent, threadKey: string, threadId: string): BaseEvent {
    const named = 'threadId' in event && event.threadId === threadKey ? { ...event, threadId } : event;
    if (named.type !== EventType.RUN_ERROR) {
      return named;
    }
    const code = 'code' in named && typeof named.code === 'string' ? named.code : 'UNKNOWN';
    this.options.logger.warn('Turn ended with an error', { threadKey, code, error: 'message' in named ? named.message : undefined });
    return { ...named, message: RUN_ERROR_MESSAGES[code] ?? RUN_ERROR_MESSAGE };
  }

  private errorHandler(): ErrorRequestHandler {
    return (error: unknown, _req, res, next) => {
      if (res.headersSent) {
        // The stream already started; the only thing left is to close it.
        next(error);
        return;
      }
      const failure = this.toHttpError(error);
      res.status(failure.status).json({ error: { code: failure.code, message: failure.message } });
    };
  }

  private toHttpError(error: unknown): HttpError {
    if (error instanceof HttpError) {
      return error;
    }
    if (typeof error === 'object' && error !== null && 'type' in error) {
      if (error.type === 'entity.too.large') {
        return new HttpError(413, 'too_large', `The body is larger than ${BODY_LIMIT}.`);
      }
      if (error.type === 'entity.parse.failed') {
        return new HttpError(400, 'invalid_json', 'The body is not valid JSON.');
      }
    }
    this.options.logger.error('Request failed', { error });
    return new HttpError(500, 'internal', 'Lumi failed to answer.');
  }
}
