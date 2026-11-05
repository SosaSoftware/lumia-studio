import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EventType } from '@ag-ui/core';
import { LocalFileStorage } from '@strands-agents/sdk/storage';
import { DEFAULT_LUMI_MCP_TOKEN_HEADER } from '@lumia/packages/lumi-env';
import { LocalStudio } from '@lumia/sandbox/testing';
import { UnauthenticatedError } from '../../src/identity/caller.ts';
import { DevTokenVerifier } from '../../src/identity/dev-token-verifier.ts';
import { LumiAgentFactory, OPEN_TARGETS } from '../../src/lumi.agent.ts';
import { LumiAssets } from '../../src/lumi-assets.ts';
import { StudioMcpConnector } from '../../src/mcp/studio-mcp-connector.ts';
import type { PreferenceMemory } from '../../src/memory/preference-memory.ts';
import { AguiServer } from '../../src/server/agui-server.ts';
import { InputGuard } from '../../src/server/input-guard.ts';
import { ScreenContext } from '../../src/server/screen-context.ts';
import { ThreadRegistry } from '../../src/server/thread-registry.ts';
import { JsonLogger } from '../../src/shared/logger.ts';
import { ConversationStore } from '../../src/storage/conversation-store.ts';
import { CONFIRM_CHANGE_DECLARATION, TempDir } from '../support/conversation-harness.ts';
import { ScriptedModel } from '../support/scripted-model.ts';
import type { ScriptedStep } from '../support/scripted-model.ts';

// Lumi against a real Studio MCP: the sandbox API and the gateway emulator on the sandbox Postgres. The model is
// scripted, so these tests check the wiring (token, access, tools, consent) without calling Bedrock. Reads only.
const quiet = new JsonLogger('error', {}, () => undefined);
const dir = new TempDir();
let studio: LocalStudio;
const tokens = { creator: '', viewer: '' };

function connector(): StudioMcpConnector {
  return new StudioMcpConnector({ url: studio.mcpUrl, tokenHeader: DEFAULT_LUMI_MCP_TOKEN_HEADER, openTargets: OPEN_TARGETS, logger: quiet });
}

beforeAll(async () => {
  studio = await LocalStudio.start();
  tokens.creator = await studio.login('creadora@studio.test');
  tokens.viewer = await studio.login('lectora@studio.test');
});

afterAll(async () => {
  await studio.close();
  dir.dispose();
});

describe('Studio MCP through the gateway', () => {
  it('shows each person only the Studio tools their role allows', async () => {
    const creator = await connector().connect(tokens.creator);
    const viewer = await connector().connect(tokens.viewer);
    const creatorTools = creator.tools.map((tool) => tool.name);
    const viewerTools = viewer.tools.map((tool) => tool.name);
    expect(creatorTools).toEqual(expect.arrayContaining(['studio-read___get_class', 'studio-slides___add_slides', 'studio-timeline___save_narration']));
    expect(viewerTools).toContain('studio-read___get_class');
    expect(viewerTools.some((name) => name.startsWith('studio-slides___'))).toBe(false);
    await Promise.all([creator.close(), viewer.close()]);
  });

  it('reports a token the gateway refuses as unauthenticated', async () => {
    await expect(connector().connect('not-a-valid-token')).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});

describe('a Lumi turn over AG-UI', () => {
  let server: AguiServer;
  let base: string;
  const scripts: ScriptedStep[][] = [];

  beforeAll(async () => {
    const assets = await LumiAssets.load(fileURLToPath(new URL('../..', import.meta.url)));
    const memory: PreferenceMemory = { storesFor: () => [] };
    const factory = new LumiAgentFactory({
      assets,
      models: { create: () => new ScriptedModel(scripts.shift() ?? []) },
      studio: connector(),
      conversations: new ConversationStore(() => new LocalFileStorage(dir.path)),
      memory,
      logger: quiet,
    });
    const registry = new ThreadRegistry((request) => factory.create(request), quiet, { idleMinutes: 30, maxThreads: 5 });
    server = new AguiServer({
      name: 'lumi',
      description: 'Integration.',
      identity: new DevTokenVerifier(process.env.LUMIA_DEV_JWT_SECRET ?? ''),
      registry,
      guard: new InputGuard(new ScreenContext()),
      logger: quiet,
    });
    base = `http://127.0.0.1:${String(await server.listen(0, '127.0.0.1'))}`;
  });

  afterAll(async () => {
    await server.close();
  });

  async function run(threadId: string, text: string): Promise<Record<string, unknown>[]> {
    const response = await fetch(`${base}/invocations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream', authorization: `Bearer ${tokens.creator}` },
      body: JSON.stringify({ threadId, runId: `run-${text}`, state: {}, messages: [{ id: `u-${text}`, role: 'user', content: text }], tools: [CONFIRM_CHANGE_DECLARATION], context: [], forwardedProps: {} }),
    });
    expect(response.status).toBe(200);
    return (await response.text())
      .split('\n\n')
      .filter((frame) => frame.startsWith('data: '))
      .map((frame) => {
        const parsed: unknown = JSON.parse(frame.slice('data: '.length));
        return typeof parsed === 'object' && parsed !== null ? Object.fromEntries(Object.entries(parsed)) : {};
      });
  }

  it('reads Studio with the token of the person and answers', async () => {
    scripts.push([[{ tool: 'studio-read___list_categories', id: 'read-1', input: {} }], [{ text: 'Veo tus categorías.' }]]);
    const events = await run('integration-read-thread-0001', '¿Qué categorías tengo?');
    const result = events.find((event) => event.type === EventType.TOOL_CALL_RESULT && event.toolCallId === 'read-1');
    expect(String(result?.content)).toContain('Academia Lumia');
    expect(events.some((event) => event.type === EventType.TEXT_MESSAGE_CONTENT && event.delta === 'Veo tus categorías.')).toBe(true);
  });

  it('holds back a change to a class that the person has not confirmed', async () => {
    scripts.push([[{ tool: 'studio-slides___delete_slide', id: 'write-1', input: { nodeId: 'node', slideId: 'slide' } }], [{ text: 'Necesito tu confirmación.' }]]);
    const events = await run('integration-write-thread-0001', 'Borra la primera diapositiva');
    const result = events.find((event) => event.type === EventType.TOOL_CALL_RESULT && event.toolCallId === 'write-1');
    expect(String(result?.content)).toContain("needs the person's consent");
  });
});
