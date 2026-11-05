import { afterAll, describe, expect, it } from 'vitest';
import type { JSONValue } from '@strands-agents/sdk';
import { JsonLogger } from '../shared/logger.ts';
import { TempDir, buildTestAgent, recordingTool, runThroughAdapter, toolResults } from '../../test/support/conversation-harness.ts';
import type { ScriptedBlock, ScriptedStep } from '../../test/support/scripted-model.ts';
import { ConfirmationGate } from './confirmation-gate.ts';
import { ConfirmationPolicy } from './confirmation-policy.ts';

const dir = new TempDir();
afterAll(() => {
  dir.dispose();
});

const policy = ConfirmationPolicy.parse({ confirmationTool: 'confirm_change', readOnlyTargets: ['studio-read'], maxChangesPerConfirmation: 5 });
const quiet = new JsonLogger('error', {}, () => undefined);

const DELETE = 'studio-slides___delete_slide';
const UPDATE = 'studio-slides___update_slide';
const READ = 'studio-read___get_class';
const deleteArgs = { nodeId: 'node-1', slideId: 'slide-1' };
const updateArgs = { nodeId: 'node-1', slideId: 'slide-2', title: 'Nuevo' };

interface Change {
  readonly action: string;
  readonly arguments: Record<string, JSONValue>;
}

function confirmBlock(id: string, changes: readonly Change[]): ScriptedBlock {
  return { tool: 'confirm_change', id, input: { message: '¿Sigo?', changes: changes.map((change) => ({ ...change, summary: 'Cambio' })) } };
}

function confirm(id: string, changes: readonly Change[]): ScriptedStep {
  return [confirmBlock(id, changes)];
}

function write(id: string, tool: string, input: Record<string, JSONValue>): ScriptedStep {
  return [{ tool, id, input }];
}

const done: ScriptedStep = [{ text: 'Listo.' }];

interface Scenario {
  readonly agent: Awaited<ReturnType<typeof buildTestAgent>>['agent'];
  readonly writes: Record<string, JSONValue[]>;
  readonly threadId: string;
}

let counter = 0;

async function scenario(steps: readonly ScriptedStep[], results: Record<string, JSONValue> = {}): Promise<Scenario> {
  counter += 1;
  const threadId = `gate-${String(counter)}`;
  const writes: Record<string, JSONValue[]> = { [DELETE]: [], [UPDATE]: [], [READ]: [] };
  const tools = Object.entries(writes).map(([name, calls]) => recordingTool(name, calls, results[name] ?? { ok: true }));
  const { agent } = await buildTestAgent({ sessionDir: dir.path, sessionId: threadId, steps, tools, interventions: [new ConfirmationGate(policy, quiet)] });
  return { agent, writes, threadId };
}

async function say(s: Scenario, text: string): Promise<void> {
  await runThroughAdapter(s.agent, s.threadId, [{ id: `u-${String(Date.now())}`, role: 'user', content: text }]);
}

async function answer(s: Scenario, toolCallId: string, result: JSONValue): Promise<void> {
  await runThroughAdapter(s.agent, s.threadId, [{ id: `t-${toolCallId}`, role: 'tool', toolCallId, content: JSON.stringify(result) }]);
}

function resultOf(s: Scenario, toolUseId: string): string {
  return JSON.stringify(toolResults(s.agent).get(toolUseId));
}

describe('ConfirmationGate', () => {
  it('runs a change once the person accepts it, with the same arguments', async () => {
    const s = await scenario([confirm('c1', [{ action: DELETE, arguments: deleteArgs }]), write('w1', DELETE, deleteArgs), done]);
    await say(s, 'Borra la diapositiva 1');
    expect(s.writes[DELETE]).toEqual([]);
    await answer(s, 'c1', { confirmed: true });
    expect(s.writes[DELETE]).toEqual([deleteArgs]);
    expect(resultOf(s, 'w1')).toContain('"ok":true');
  });

  it('holds back a change without a confirmation', async () => {
    const s = await scenario([write('w1', DELETE, deleteArgs), done]);
    await say(s, 'Borra la diapositiva 1');
    expect(s.writes[DELETE]).toEqual([]);
    expect(resultOf(s, 'w1')).toContain("needs the person's consent");
  });

  it('holds back a change sent in the same response as its confirmation', async () => {
    const s = await scenario([[confirmBlock('c1', [{ action: DELETE, arguments: deleteArgs }]), { tool: DELETE, id: 'w1', input: deleteArgs }]]);
    await say(s, 'Borra la diapositiva 1');
    expect(s.writes[DELETE]).toEqual([]);
    expect(resultOf(s, 'w1')).toContain("needs the person's consent");
  });

  it('holds back a change whose arguments differ from the accepted ones', async () => {
    const s = await scenario([confirm('c1', [{ action: DELETE, arguments: deleteArgs }]), write('w1', DELETE, { ...deleteArgs, slideId: 'slide-2' }), done]);
    await say(s, 'Borra la diapositiva 1');
    await answer(s, 'c1', { confirmed: true });
    expect(s.writes[DELETE]).toEqual([]);
  });

  it('holds back a different tool with the accepted arguments', async () => {
    const s = await scenario([confirm('c1', [{ action: UPDATE, arguments: deleteArgs }]), write('w1', DELETE, deleteArgs), done]);
    await say(s, 'Cambia la diapositiva 1');
    await answer(s, 'c1', { confirmed: true });
    expect(s.writes[DELETE]).toEqual([]);
  });

  it('accepts the same arguments in another key order', async () => {
    const s = await scenario([confirm('c1', [{ action: DELETE, arguments: deleteArgs }]), write('w1', DELETE, { slideId: 'slide-1', nodeId: 'node-1' }), done]);
    await say(s, 'Borra la diapositiva 1');
    await answer(s, 'c1', { confirmed: true });
    expect(s.writes[DELETE]).toHaveLength(1);
  });

  it('runs each accepted change only once', async () => {
    const s = await scenario([
      confirm('c1', [{ action: DELETE, arguments: deleteArgs }]),
      [
        { tool: DELETE, id: 'w1', input: deleteArgs },
        { tool: DELETE, id: 'w2', input: deleteArgs },
      ],
      done,
    ]);
    await say(s, 'Borra la diapositiva 1');
    await answer(s, 'c1', { confirmed: true });
    expect(s.writes[DELETE]).toEqual([deleteArgs]);
  });

  it('runs every change of one confirmation', async () => {
    const s = await scenario([
      confirm('c1', [
        { action: DELETE, arguments: deleteArgs },
        { action: UPDATE, arguments: updateArgs },
      ]),
      [
        { tool: UPDATE, id: 'w1', input: updateArgs },
        { tool: DELETE, id: 'w2', input: deleteArgs },
      ],
      done,
    ]);
    await say(s, 'Borra la 1 y renombra la 2');
    await answer(s, 'c1', { confirmed: true });
    expect(s.writes[UPDATE]).toEqual([updateArgs]);
    expect(s.writes[DELETE]).toEqual([deleteArgs]);
  });

  it('changes nothing in the turn after a decline', async () => {
    const s = await scenario([confirm('c1', [{ action: DELETE, arguments: deleteArgs }]), write('w1', DELETE, deleteArgs), done]);
    await say(s, 'Borra la diapositiva 1');
    await answer(s, 'c1', { confirmed: false });
    expect(s.writes[DELETE]).toEqual([]);
    expect(resultOf(s, 'w1')).toContain('declined');
  });

  it('keeps holding changes back after a decline even if a later confirmation is accepted', async () => {
    const s = await scenario([confirm('c1', [{ action: DELETE, arguments: deleteArgs }]), confirm('c2', [{ action: DELETE, arguments: deleteArgs }]), write('w1', DELETE, deleteArgs), done]);
    await say(s, 'Borra la diapositiva 1');
    await answer(s, 'c1', { confirmed: false });
    await answer(s, 'c2', { confirmed: true });
    expect(s.writes[DELETE]).toEqual([]);
  });

  it('lets Lumi ask again when the browser could not show the confirmation', async () => {
    const s = await scenario([confirm('c1', [{ action: DELETE, arguments: deleteArgs }]), confirm('c2', [{ action: DELETE, arguments: deleteArgs }]), write('w1', DELETE, deleteArgs), done]);
    await say(s, 'Borra la diapositiva 1');
    await answer(s, 'c1', { confirmed: false, error: 'Invalid request.' });
    await answer(s, 'c2', { confirmed: true });
    expect(s.writes[DELETE]).toEqual([deleteArgs]);
  });

  it('grants nothing for a malformed confirmation, even if accepted', async () => {
    const s = await scenario([[{ tool: 'confirm_change', id: 'c1', input: { message: '¿Sigo?', changes: [] } }], write('w1', DELETE, deleteArgs), done]);
    await say(s, 'Borra la diapositiva 1');
    await answer(s, 'c1', { confirmed: true });
    expect(s.writes[DELETE]).toEqual([]);
  });

  it('does not carry an approval over to the next message of the person', async () => {
    const s = await scenario([confirm('c1', [{ action: DELETE, arguments: deleteArgs }]), [{ text: '¿Lo borro?' }], write('w1', DELETE, deleteArgs), done]);
    await say(s, 'Borra la diapositiva 1');
    await answer(s, 'c1', { confirmed: true });
    await say(s, 'Sí, hazlo');
    expect(s.writes[DELETE]).toEqual([]);
  });

  it('keeps the consent state across a restart of the agent', async () => {
    const s = await scenario([confirm('c1', [{ action: DELETE, arguments: deleteArgs }])]);
    await say(s, 'Borra la diapositiva 1');
    const writes: JSONValue[] = [];
    const { agent } = await buildTestAgent({
      sessionDir: dir.path,
      sessionId: s.threadId,
      steps: [[{ tool: DELETE, id: 'w1', input: deleteArgs }, { tool: DELETE, id: 'w2', input: deleteArgs }], done],
      tools: [recordingTool(DELETE, writes)],
      interventions: [new ConfirmationGate(policy, quiet)],
    });
    await runThroughAdapter(agent, s.threadId, [{ id: 't1', role: 'tool', toolCallId: 'c1', content: '{"confirmed":true}' }]);
    expect(writes).toEqual([deleteArgs]);
  });

  it('translates ids when an earlier change of the turn created the draft', async () => {
    const s = await scenario(
      [
        confirm('c1', [
          { action: DELETE, arguments: deleteArgs },
          { action: UPDATE, arguments: updateArgs },
        ]),
        write('w1', DELETE, deleteArgs),
        write('w2', UPDATE, { ...updateArgs, slideId: 'draft-slide-2' }),
        done,
      ],
      { [DELETE]: { deleted: true, draft: { versionNumber: 2, note: 'Ids changed.', idMap: { 'slide-1': 'draft-slide-1', 'slide-2': 'draft-slide-2' } } } },
    );
    await say(s, 'Borra la 1 y renombra la 2');
    await answer(s, 'c1', { confirmed: true });
    expect(s.writes[UPDATE]).toEqual([{ ...updateArgs, slideId: 'draft-slide-2' }]);
  });

  it('lets reads run without consent', async () => {
    const s = await scenario([write('r1', READ, { nodeId: 'node-1' }), [{ text: 'Leí la clase.' }]]);
    await say(s, '¿Qué tiene la clase?');
    expect(s.writes[READ]).toEqual([{ nodeId: 'node-1' }]);
  });
});
