import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LocalFileStorage } from '@strands-agents/sdk/storage';
import { FileMemoryStore } from '@strands-agents/sdk/vended-memory-stores/file-memory-store';
import type { Caller } from './identity/caller.ts';
import { LumiAgentFactory } from './lumi.agent.ts';
import { LumiAssets } from './lumi-assets.ts';
import type { StudioToolSet, StudioToolSource } from './mcp/studio-mcp-connector.ts';
import type { PreferenceMemory } from './memory/preference-memory.ts';
import { JsonLogger } from './shared/logger.ts';
import { ConversationStore } from './storage/conversation-store.ts';
import { TempDir, recordingTool } from '../test/support/conversation-harness.ts';
import { ScriptedModel } from '../test/support/scripted-model.ts';

const dir = new TempDir();
const quiet = new JsonLogger('error', {}, () => undefined);
const ana: Caller = { sub: 'ana', token: 'ana-token' };
const beto: Caller = { sub: 'beto', token: 'beto-token' };
let assets: LumiAssets;

beforeAll(async () => {
  assets = await LumiAssets.load(fileURLToPath(new URL('..', import.meta.url)));
});
afterAll(() => {
  dir.dispose();
});

class FakeStudio implements StudioToolSource {
  public readonly tokens: string[] = [];
  public closed = 0;

  public connect(token: string): Promise<StudioToolSet> {
    this.tokens.push(token);
    return Promise.resolve({
      tools: [recordingTool('studio-read___get_class', []), recordingTool('studio-slides___add_slides', [])],
      close: () => {
        this.closed += 1;
        return Promise.resolve();
      },
    });
  }
}

/** Preferences without extraction, so no background call consumes the scripted replies. */
const memory: PreferenceMemory = {
  storesFor: (actorKey) => [new FileMemoryStore({ name: 'preferences', description: 'Preferences.', storage: new LocalFileStorage(dir.path).namespace(`memory-${actorKey}`) })],
};

function factory(studio: StudioToolSource, replies: string[] = []): LumiAgentFactory {
  return new LumiAgentFactory({
    assets,
    models: { create: () => new ScriptedModel(replies.map((text) => [{ text }])) },
    studio,
    conversations: new ConversationStore(() => new LocalFileStorage(dir.path)),
    memory,
    logger: quiet,
  });
}

describe('LumiAgentFactory', () => {
  it('builds Lumi with the Studio tools of the person and only the harness tools it needs', async () => {
    const studio = new FakeStudio();
    const thread = await factory(studio).create({ caller: ana, threadId: 'thread-tools' });
    expect(studio.tokens).toEqual(['ana-token']);
    expect(thread.agent.id).toBe('lumi');
    expect(
      thread.agent.toolRegistry
        .list()
        .map((tool) => tool.name)
        .sort(),
    ).toEqual(['retrieve_context', 'search_memory', 'skills', 'studio-read___get_class', 'studio-slides___add_slides', 'todo_write']);
    const prompt = JSON.stringify(thread.agent.systemPrompt);
    expect(prompt).toContain('You are an agent.');
    expect(prompt).toContain('You are Lumi');
    await thread.dispose();
    expect(studio.closed).toBe(1);
  });

  it('restores the conversation of the same person and keeps it from anyone else', async () => {
    const first = await factory(new FakeStudio(), ['Hola, Ana.']).create({ caller: ana, threadId: 'shared-thread' });
    await first.agent.invoke('Hola');
    await first.dispose();

    const restored = await factory(new FakeStudio()).create({ caller: ana, threadId: 'shared-thread' });
    expect(restored.agent.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
    const stranger = await factory(new FakeStudio()).create({ caller: beto, threadId: 'shared-thread' });
    expect(stranger.agent.messages).toEqual([]);
    await Promise.all([restored.dispose(), stranger.dispose()]);
  });

  it('closes the Studio connection when building the agent fails', async () => {
    const studio = new FakeStudio();
    const broken = new LumiAgentFactory({
      assets,
      models: {
        create: () => {
          throw new Error('no model');
        },
      },
      studio,
      conversations: new ConversationStore(() => new LocalFileStorage(dir.path)),
      memory,
      logger: quiet,
    });
    await expect(broken.create({ caller: ana, threadId: 'thread-broken' })).rejects.toThrow('no model');
    expect(studio.closed).toBe(1);
  });
});
