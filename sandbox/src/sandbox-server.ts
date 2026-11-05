import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { createYoga } from 'graphql-yoga';
import type { Plugin } from 'graphql-yoga';
import { ClaimsBuilder, UnauthorizedError } from '@lumia/api/auth';
import type { Config } from '@lumia/api/config';
import { createDatabase } from '@lumia/api/db';
import type { CloseableDatabase } from '@lumia/api/db';
import { STUDIO_FIELDS, STUDIO_SCHEMA_PATH } from '@lumia/api/graphql';
import { HANDLERS } from '@lumia/api/handlers';
import { Logger } from '@lumia/api/log';
import { FieldPipeline } from '@lumia/api/runtime';
import { FileSystemObjectStorage } from '@lumia/api/storage';
import { DevAuth, DevJwtIssuer, DevJwtVerifier } from './auth/index.ts';
import { AppSyncErrors } from './graphql/app-sync-errors.ts';
import { LocalAppSync } from './graphql/local-appsync.ts';
import { StorageRoutes } from './storage/storage-routes.ts';

type NodeHandler = (req: IncomingMessage, res: ServerResponse) => unknown;

const MAX_BODY_BYTES = 100 * 1024 * 1024;
export const GRAPHQL_PATH = '/graphql';
export const DEV_LOGIN_PATH = '/dev/login';

/** Rewrites GraphQL errors into the AppSync format (`errorType` and message). */
const appSyncErrors: Plugin = {
  onResultProcess: (context) => {
    const { result } = context;
    if (Array.isArray(result) || !('errors' in result)) {
      return;
    }
    if (result.errors !== undefined) {
      context.setResult(AppSyncErrors.format(result));
    }
  },
};

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new RangeError('Request body too large');
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

/**
 * Local replacement of AppSync, Cognito and S3: one HTTP server with the GraphQL API (same schema, field registry and
 * handlers as AppSync), the development login and the signed storage routes.
 */
export class SandboxServer {
  private server: Server | undefined;

  private constructor(
    private readonly graphql: NodeHandler,
    private readonly devAuth: DevAuth,
    private readonly storageRoutes: StorageRoutes,
    private readonly db: CloseableDatabase,
    private readonly logger: Logger,
  ) {}

  /** Wires the pipeline from configuration: the same one the Lambdas use, with access and policies read from the database. */
  public static create(config: Config, logger: Logger = new Logger({ service: 'sandbox' })): Promise<SandboxServer> {
    const db = createDatabase('studio_app', config);
    const schema = new LocalAppSync({
      schemaPath: STUDIO_SCHEMA_PATH,
      fields: STUDIO_FIELDS,
      pipeline: FieldPipeline.on(db, STUDIO_FIELDS, HANDLERS),
      verifier: DevJwtVerifier.fromConfig(config),
      logger,
    }).buildSchema();
    const graphql = createYoga({
      schema,
      graphqlEndpoint: GRAPHQL_PATH,
      landingPage: false,
      graphiql: false,
      cors: false,
      maskedErrors: false,
      logging: false,
      plugins: [appSyncErrors],
    });
    const port = config.integer('LUMIA_API_PORT', 4000);
    const storage = new FileSystemObjectStorage({
      root: config.optional('LUMIA_STORAGE_ROOT', '.sandbox/storage'),
      baseUrl: config.optional('LUMIA_API_BASE_URL', `http://localhost:${String(port)}`),
      signingSecret: config.required('LUMIA_STORAGE_SIGNING_SECRET'),
    });
    const devAuth = new DevAuth(new ClaimsBuilder(db), DevJwtIssuer.fromConfig(config));
    return Promise.resolve(new SandboxServer(graphql, devAuth, new StorageRoutes(storage), db, logger));
  }

  /** Starts listening; returns the bound port (useful with port 0). */
  public listen(port: number): Promise<number> {
    const server = createServer((req, res) => {
      this.dispatch(req, res).catch((error: unknown) => {
        this.logger.error('Unhandled request failure', { error });
        if (!res.headersSent) {
          res.writeHead(500, { 'content-type': 'application/json' });
        }
        res.end(JSON.stringify({ errors: [{ errorType: 'InternalError', message: 'Ocurrió un error interno.' }] }));
      });
    });
    this.server = server;
    return new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, () => {
        const address = server.address();
        resolve(typeof address === 'object' && address !== null ? address.port : port);
      });
    });
  }

  public async close(): Promise<void> {
    const server = this.server;
    if (server !== undefined) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error === undefined) resolve();
          else reject(error);
        });
        server.closeAllConnections();
      });
    }
    await this.db.close();
  }

  private async dispatch(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', 'http://localhost');
    this.applyCors(req, res);
    if (method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }
    if (url.pathname === '/health' && method === 'GET') {
      SandboxServer.json(res, 200, { status: 'ok' });
    } else if (url.pathname === DEV_LOGIN_PATH && method === 'POST') {
      await this.login(req, res);
    } else if (url.pathname.startsWith('/storage/')) {
      await this.storage(method, url, req, res);
    } else if (url.pathname === GRAPHQL_PATH) {
      await this.graphql(req, res);
    } else {
      SandboxServer.json(res, 404, { message: 'Ruta no encontrada.' });
    }
  }

  /** `POST /dev/login` with `{ "email": "..." }`: 401 for an unknown account, 403 for an account without access. */
  private async login(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let body: unknown;
    try {
      body = JSON.parse((await readBody(req)).toString('utf8'));
    } catch {
      // Unparseable input is a client error, not a server failure.
      SandboxServer.json(res, 400, { message: 'El cuerpo debe ser JSON.' });
      return;
    }
    const email = typeof body === 'object' && body !== null && 'email' in body ? body.email : null;
    if (typeof email !== 'string' || email.trim() === '') {
      SandboxServer.json(res, 400, { message: 'Escribe el correo.' });
      return;
    }
    try {
      SandboxServer.json(res, 200, await this.devAuth.login(email));
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        SandboxServer.json(res, error.reason === 'no_access' ? 403 : 401, { message: error.message, reason: error.reason });
        return;
      }
      throw error;
    }
  }

  private async storage(method: string, url: URL, req: IncomingMessage, res: ServerResponse): Promise<void> {
    const result = await this.storageRoutes.handle(method, url, async () => new Uint8Array(await readBody(req)));
    res.writeHead(result.status, result.contentType === undefined ? {} : { 'content-type': result.contentType });
    res.end(result.body);
  }

  private applyCors(req: IncomingMessage, res: ServerResponse): void {
    res.setHeader('access-control-allow-origin', req.headers.origin ?? '*');
    res.setHeader('vary', 'Origin');
    res.setHeader('access-control-allow-headers', 'authorization, content-type');
    res.setHeader('access-control-allow-methods', 'GET, POST, PUT, OPTIONS');
  }

  private static json(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  }
}
