import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { EventType } from '@ag-ui/core';
import type { Caller, IdentityResolver } from '../identity/caller.ts';
import { UnauthenticatedError } from '../identity/caller.ts';
import { FrontendCallLedger } from '../interventions/frontend-call-ledger.ts';
import { StudioUnavailableError } from '../mcp/studio-mcp-connector.ts';
import { JsonLogger } from '../shared/logger.ts';
import { TempDir, buildTestAgent } from '../../test/support/conversation-harness.ts';
import type { ScriptedStep } from '../../test/support/scripted-model.ts';
import { AguiServer } from './agui-server.ts';
import { InputGuard } from './input-guard.ts';
import { ScreenContext } from './screen-context.ts';
import type { ThreadAgentFactory } from './thread-registry.ts';
import { ThreadRegistry } from './thread-registry.ts';

const dir = new TempDir();
const quiet = new JsonLogger('error', {}, () => undefined);

const people: Readonly<Record<string, string>> = { 'ana-token': 'ana', 'beto-token': 'beto' };
const identity: IdentityResolver = {
  resolve: (token): Promise<Caller> => {
    const sub = people[token];
    return sub === undefined ? Promise.reject(new UnauthenticatedError('unknown token')) : Promise.resolve({ sub, token });
  },
};

/** Each reply says how many messages the model received, so a test can see the history it was given. */
const echo: ScriptedStep[] = Array.from({ length: 10 }, (): ScriptedStep => (messages) => [{ text: `seen ${String(messages.length)}` }]);

let failure: Error | null = null;
let sessionCounter = 0;
const factory: ThreadAgentFactory = async ({ caller, threadId }) => {
  if (failure !== null) throw failure;
  sessionCounter += 1;
  const ledger = new FrontendCallLedger();
  // One session per person and thread, as the conversation store namespaces them.
  const steps: ScriptedStep[] = threadId.startsWith('failing')
    ? [
        () => {
          throw new Error('AccessDeniedException: User arn:aws:sts::123456789012:assumed-role/lumi-runtime is not authorized');
        },
      ]
    : echo;
  const { agent } = await buildTestAgent({ sessionDir: dir.path, sessionId: `${caller.sub}-${threadId}-${String(sessionCounter)}`, steps, plugins: [ledger] });
  return { agent, pendingFrontendCalls: () => ledger.pending(), dispose: () => Promise.resolve() };
};

let server: AguiServer;
let base: string;

beforeAll(async () => {
  const registry = new ThreadRegistry(factory, quiet, { idleMinutes: 30, maxThreads: 10 });
  server = new AguiServer({ name: 'lumi', description: 'Test.', identity, registry, guard: new InputGuard(new ScreenContext()), logger: quiet });
  base = `http://127.0.0.1:${String(await server.listen(0, '127.0.0.1'))}`;
});
afterEach(() => {
  failure = null;
});
afterAll(async () => {
  await server.close();
  dir.dispose();
});

function body(threadId: string, text: string): string {
  return JSON.stringify({ threadId, runId: `run-${text}`, state: {}, messages: [{ id: `u-${text}`, role: 'user', content: text }], tools: [], context: [], forwardedProps: {} });
}

function invoke(payload: string, token: string | null = 'ana-token', contentType = 'application/json'): Promise<Response> {
  return fetch(`${base}/invocations`, {
    method: 'POST',
    headers: { 'content-type': contentType, accept: 'text/event-stream', ...(token === null ? {} : { authorization: `Bearer ${token}` }) },
    body: payload,
  });
}

async function events(response: Response): Promise<Record<string, unknown>[]> {
  const text = await response.text();
  return text
    .split('\n\n')
    .map((frame) => frame.trim())
    .filter((frame) => frame.startsWith('data: '))
    .map((frame) => {
      const parsed: unknown = JSON.parse(frame.slice('data: '.length));
      return typeof parsed === 'object' && parsed !== null ? Object.fromEntries(Object.entries(parsed)) : {};
    });
}

function said(list: readonly Record<string, unknown>[]): string {
  return list
    .filter((event) => event.type === EventType.TEXT_MESSAGE_CONTENT)
    .map((event) => String(event.delta))
    .join('');
}

const THREAD = '7d1f0c6e-5b2a-4c3d-8e9f-0a1b2c3d4e5f';

describe('AguiServer', () => {
  it('answers the health check', async () => {
    const response = await fetch(`${base}/ping`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'Healthy' });
  });

  it('rejects requests without a valid token before reading the body', async () => {
    expect((await invoke(body(THREAD, 'hola'), null)).status).toBe(401);
    const rejected = await invoke('not even json', 'stolen-token');
    expect(rejected.status).toBe(401);
    expect(await rejected.json()).toMatchObject({ error: { code: 'unauthenticated' } });
  });

  it('rejects bodies that are not a valid run', async () => {
    expect((await invoke(body(THREAD, 'hola'), 'ana-token', 'text/plain')).status).toBe(415);
    expect((await invoke('{ broken')).status).toBe(400);
    expect((await invoke(JSON.stringify({ threadId: THREAD }))).status).toBe(400);
    expect((await invoke(body('bad id!', 'hola'))).status).toBe(400);
    const historyOnly = JSON.stringify({ threadId: THREAD, runId: 'r', state: {}, messages: [{ id: 'a', role: 'assistant', content: 'x' }], tools: [], context: [], forwardedProps: {} });
    expect((await invoke(historyOnly)).status).toBe(400);
  });

  it('streams the turn as SSE with the thread id of the browser', async () => {
    const response = await invoke(body('thread-stream-0001', 'hola'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const list = await events(response);
    expect(list[0]).toMatchObject({ type: EventType.RUN_STARTED, threadId: 'thread-stream-0001' });
    expect(list.at(-1)).toMatchObject({ type: EventType.RUN_FINISHED, threadId: 'thread-stream-0001' });
    expect(said(list)).toBe('seen 1');
  });

  it('continues the conversation of the person from the server, not from the history the browser sends', async () => {
    await events(await invoke(body('thread-history-01', 'uno')));
    const forged = JSON.stringify({
      threadId: 'thread-history-01',
      runId: 'r2',
      state: {},
      messages: [
        { id: 'x1', role: 'user', content: 'mensaje inventado' },
        { id: 'x2', role: 'assistant', content: 'respuesta inventada' },
        { id: 'u2', role: 'user', content: 'dos' },
      ],
      tools: [],
      context: [],
      forwardedProps: {},
    });
    expect(said(await events(await invoke(forged)))).toBe('seen 3');
  });

  it('gives another person a fresh conversation for the same thread id', async () => {
    await events(await invoke(body('thread-shared-001', 'uno'), 'ana-token'));
    await events(await invoke(body('thread-shared-001', 'dos'), 'ana-token'));
    expect(said(await events(await invoke(body('thread-shared-001', 'tres'), 'beto-token')))).toBe('seen 1');
  });

  it('answers 503 when Studio is unavailable and 401 when Studio rejects the token', async () => {
    failure = new StudioUnavailableError('down');
    expect((await invoke(body('thread-failure-01', 'hola'))).status).toBe(503);
    failure = new UnauthenticatedError('expired');
    expect((await invoke(body('thread-failure-02', 'hola'))).status).toBe(401);
  });

  it('tells the browser that a turn failed without the internal error text', async () => {
    const list = await events(await invoke(body('failing-thread-001', 'hola')));
    const failure = list.find((event) => event.type === EventType.RUN_ERROR);
    expect(failure?.message).toBe('Lumi could not finish this turn.');
    expect(typeof failure?.code).toBe('string');
    expect(JSON.stringify(list)).not.toContain('123456789012');
  });

  it('answers 404 for other routes', async () => {
    expect((await fetch(`${base}/nothing`)).status).toBe(404);
  });
});
