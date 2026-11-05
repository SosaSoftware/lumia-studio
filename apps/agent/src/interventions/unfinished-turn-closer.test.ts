import { afterAll, describe, expect, it } from 'vitest';
import type { Message } from '@strands-agents/sdk';
import { TempDir, buildTestAgent, runThroughAdapter } from '../../test/support/conversation-harness.ts';
import { FrontendCallLedger } from './frontend-call-ledger.ts';
import { UNFINISHED_TURN_REPLY, UnfinishedTurnCloser } from './unfinished-turn-closer.ts';

const dir = new TempDir();
afterAll(() => {
  dir.dispose();
});

function roles(messages: readonly Message[] | undefined): string[] {
  return (messages ?? []).map((message) => message.role);
}

function texts(messages: readonly Message[] | undefined): string[] {
  return (messages ?? []).flatMap((message) => message.content.flatMap((block) => (block.type === 'textBlock' ? [block.text] : [])));
}

describe('UnfinishedTurnCloser', () => {
  it('closes a turn whose model call failed, so the next message follows a reply', async () => {
    const { agent, model } = await buildTestAgent({
      sessionDir: dir.path,
      sessionId: 'closer-error',
      steps: [
        () => {
          throw new Error('ThrottlingException');
        },
        [{ text: 'Ahora sí.' }],
      ],
      plugins: [new UnfinishedTurnCloser()],
    });
    await runThroughAdapter(agent, 'closer-error', [{ id: 'u1', role: 'user', content: 'hola' }]);
    await runThroughAdapter(agent, 'closer-error', [{ id: 'u2', role: 'user', content: 'otra vez' }]);
    expect(roles(model.calls[1])).toEqual(['user', 'assistant', 'user']);
    expect(texts(model.calls[1])).toEqual(['hola', UNFINISHED_TURN_REPLY, 'otra vez']);
  });

  it('closes a turn left on an unanswered screen call when the person writes again', async () => {
    const { agent, model } = await buildTestAgent({
      sessionDir: dir.path,
      sessionId: 'closer-pending',
      steps: [[{ tool: 'confirm_change', id: 'c1', input: { message: '¿Sigo?', changes: [] } }], [{ text: 'Vale.' }]],
      plugins: [new FrontendCallLedger(), new UnfinishedTurnCloser()],
    });
    await runThroughAdapter(agent, 'closer-pending', [{ id: 'u1', role: 'user', content: 'Borra la portada' }]);
    await runThroughAdapter(agent, 'closer-pending', [
      { id: 't1', role: 'tool', toolCallId: 'c1', content: '{"answered":false}' },
      { id: 'u2', role: 'user', content: 'Mejor no' },
    ]);
    expect(roles(model.calls[1])).toEqual(['user', 'assistant', 'user', 'assistant', 'user']);
    expect(texts(model.calls[1]).at(-1)).toBe('Mejor no');
  });

  it('leaves a conversation that alternates as it is, and continuations untouched', async () => {
    const { agent, model } = await buildTestAgent({
      sessionDir: dir.path,
      sessionId: 'closer-normal',
      steps: [[{ tool: 'select_slide', id: 's1', input: { slideId: 'a' } }], [{ text: 'Seleccionada.' }], [{ text: 'Hola.' }]],
      plugins: [new FrontendCallLedger(), new UnfinishedTurnCloser()],
    });
    await runThroughAdapter(agent, 'closer-normal', [{ id: 'u1', role: 'user', content: 'Selecciona la primera' }]);
    await runThroughAdapter(agent, 'closer-normal', [{ id: 't1', role: 'tool', toolCallId: 's1', content: '{"selected":true}' }]);
    await runThroughAdapter(agent, 'closer-normal', [{ id: 'u2', role: 'user', content: 'Gracias' }]);
    expect(texts(model.calls[2])).not.toContain(UNFINISHED_TURN_REPLY);
    expect(roles(model.calls[2])).toEqual(['user', 'assistant', 'user', 'assistant', 'user']);
  });
});
