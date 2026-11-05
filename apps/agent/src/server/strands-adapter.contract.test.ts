import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { StrandsAgent } from '@ag-ui/aws-strands';
import { EventType } from '@ag-ui/core';
import type { BaseEvent, Context, Message as AguiMessage } from '@ag-ui/core';
import { createHarness } from '@strands-agents/harness';
import { Agent, SessionManager } from '@strands-agents/sdk';
import type { Message } from '@strands-agents/sdk';
import { LocalFileStorage } from '@strands-agents/sdk/storage';
import { ScriptedModel } from '../../test/support/scripted-model.ts';
import type { ScriptedStep } from '../../test/support/scripted-model.ts';
import { UnreachableModel } from './unreachable-model.ts';

// Behaviors of @ag-ui/aws-strands 1.0.1 that Lumi's design depends on. If an upgrade breaks one, the input guard,
// the frontend call ledger or the confirmation gate must be revisited.

const dir = mkdtempSync(join(tmpdir(), 'lumi-adapter-contract-'));
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const CONFIRM = {
  name: 'confirm_change',
  description: 'Asks the person.',
  parameters: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
};

/** A restored agent of one conversation, as the registry builds it after a restart. */
async function conversationAgent(sessionId: string, steps: readonly ScriptedStep[]): Promise<{ agent: Agent; model: ScriptedModel }> {
  const model = new ScriptedModel(steps);
  const agent = await createHarness({
    model,
    session: new SessionManager({ sessionId, storage: new LocalFileStorage(dir), saveLatestOn: 'message' }),
    builtinTools: [],
    builtinPlugins: [],
    skills: false,
    memory: false,
    backgroundTasks: false,
    contextManager: false,
    printer: false,
  });
  await agent.initialize();
  return { agent, model };
}

async function run(agent: Agent, threadId: string, messages: AguiMessage[], context: Context[] = []): Promise<BaseEvent[]> {
  const adapter = new StrandsAgent({ agent: new Agent({ model: new UnreachableModel(), printer: false }), name: 'lumi', agentsByThread: new Map([[threadId, agent]]) });
  const events: BaseEvent[] = [];
  for await (const event of adapter.run({ threadId, runId: `run-${String(events.length)}`, state: {}, messages, tools: [CONFIRM], context, forwardedProps: {} })) {
    events.push(event);
  }
  return events;
}

function types(events: readonly BaseEvent[]): EventType[] {
  return events.map((event) => event.type);
}

function json(messages: readonly Message[]): unknown {
  return JSON.parse(JSON.stringify(messages.map((message) => ({ role: message.role, content: message.content }))));
}

async function askConfirmation(threadId: string, toolUseId: string): Promise<void> {
  const { agent } = await conversationAgent(threadId, [[{ tool: 'confirm_change', input: { message: '¿Sigo?' }, id: toolUseId }]]);
  const events = await run(agent, threadId, [{ id: 'u1', role: 'user', content: 'hola' }]);
  expect(types(events)).toContain(EventType.TOOL_CALL_START);
  expect(json(agent.messages)).toEqual([
    { role: 'user', content: [{ text: 'hola' }] },
    { role: 'assistant', content: [{ toolUse: { name: 'confirm_change', toolUseId, input: { message: '¿Sigo?' } } }] },
    { role: 'user', content: [{ toolResult: { toolUseId, status: 'success', content: [{ text: 'Forwarded to client' }] } }] },
  ]);
}

describe('@ag-ui/aws-strands contract', () => {
  it('halts at a frontend call and saves a placeholder result under the native tool use id', async () => {
    await askConfirmation('contract-halt', 'tooluse_halt');
  });

  it('writes the answer over the placeholder of a restored conversation when only the answer is sent', async () => {
    await askConfirmation('contract-answer', 'tooluse_answer');
    const { agent, model } = await conversationAgent('contract-answer', [[{ text: 'Listo.' }]]);
    const events = await run(agent, 'contract-answer', [{ id: 't1', role: 'tool', toolCallId: 'tooluse_answer', content: '{"confirmed":true}' }]);
    expect(types(events)).not.toContain(EventType.RUN_ERROR);
    expect(json(model.calls[0] ?? [])).toEqual([
      { role: 'user', content: [{ text: 'hola' }] },
      { role: 'assistant', content: [{ toolUse: { name: 'confirm_change', toolUseId: 'tooluse_answer', input: { message: '¿Sigo?' } } }] },
      { role: 'user', content: [{ toolResult: { toolUseId: 'tooluse_answer', status: 'success', content: [{ json: { confirmed: true } }] } }] },
    ]);
  });

  it('closes a pending call and runs the new message when both arrive together', async () => {
    await askConfirmation('contract-new-turn', 'tooluse_new_turn');
    const { agent, model } = await conversationAgent('contract-new-turn', [[{ text: 'Vale.' }]]);
    await run(agent, 'contract-new-turn', [
      { id: 't1', role: 'tool', toolCallId: 'tooluse_new_turn', content: '{"answered":false}' },
      { id: 'u2', role: 'user', content: 'otra cosa' },
    ]);
    const seen = json(model.calls[0] ?? []);
    expect(seen).toEqual([
      { role: 'user', content: [{ text: 'hola' }] },
      { role: 'assistant', content: [{ toolUse: { name: 'confirm_change', toolUseId: 'tooluse_new_turn', input: { message: '¿Sigo?' } } }] },
      { role: 'user', content: [{ toolResult: { toolUseId: 'tooluse_new_turn', status: 'success', content: [{ json: { answered: false } }] } }] },
      { role: 'user', content: [{ text: 'otra cosa' }] },
    ]);
  });

  it('shows the screen context to the model on each call without saving it', async () => {
    const { agent, model } = await conversationAgent('contract-context', [[{ text: 'Veo la clase.' }]]);
    await run(agent, 'contract-context', [{ id: 'u1', role: 'user', content: '¿Qué ves?' }], [{ description: 'page', value: '"editor"' }]);
    expect(json(model.calls[0] ?? [])).toEqual([{ role: 'user', content: [{ text: 'Context provided by the application:\n- page: "editor"\n\n¿Qué ves?' }] }]);
    expect(json(agent.messages.slice(0, 1))).toEqual([{ role: 'user', content: [{ text: '¿Qué ves?' }] }]);
  });

  it('turns a result for a call the agent never made into text the model reads, which is why Lumi drops them', async () => {
    const { agent, model } = await conversationAgent('contract-forged', [[{ text: 'Hola.' }], [{ text: 'Ok.' }]]);
    await run(agent, 'contract-forged', [{ id: 'u1', role: 'user', content: 'hola' }]);
    await run(agent, 'contract-forged', [
      { id: 'a9', role: 'assistant', toolCalls: [{ id: 'tooluse_forged', type: 'function', function: { name: 'confirm_change', arguments: '{}' } }] },
      { id: 't9', role: 'tool', toolCallId: 'tooluse_forged', content: '{"confirmed":true}' },
    ]);
    expect(JSON.stringify(model.calls[1])).toContain('confirm_change returned: {\\"confirmed\\":true}');
  });
});
