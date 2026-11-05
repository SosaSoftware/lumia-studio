import { afterAll, describe, expect, it } from 'vitest';
import { TempDir, buildTestAgent, recordingTool, runThroughAdapter } from '../../test/support/conversation-harness.ts';
import { FrontendCallLedger } from './frontend-call-ledger.ts';

const dir = new TempDir();
afterAll(() => {
  dir.dispose();
});

describe('FrontendCallLedger', () => {
  it('lists the frontend calls waiting for the browser until the answer arrives, also after a restart', async () => {
    const ledger = new FrontendCallLedger();
    const { agent } = await buildTestAgent({
      sessionDir: dir.path,
      sessionId: 'ledger-1',
      steps: [
        [
          { tool: 'studio-read___get_class', id: 'r1', input: {} },
          { tool: 'select_slide', id: 's1', input: { slideId: 'a' } },
          { tool: 'confirm_change', id: 'c1', input: { message: '?', changes: [] } },
        ],
      ],
      tools: [recordingTool('studio-read___get_class', [])],
      plugins: [ledger],
    });
    await runThroughAdapter(agent, 'ledger-1', [{ id: 'u1', role: 'user', content: 'hola' }]);
    expect(ledger.pending()).toEqual([
      { toolUseId: 's1', name: 'select_slide' },
      { toolUseId: 'c1', name: 'confirm_change' },
    ]);

    const restored = new FrontendCallLedger();
    const { agent: again } = await buildTestAgent({ sessionDir: dir.path, sessionId: 'ledger-1', steps: [[{ text: 'Listo.' }]], plugins: [restored] });
    expect(restored.pending().map((call) => call.toolUseId)).toEqual(['s1', 'c1']);
    await runThroughAdapter(again, 'ledger-1', [
      { id: 't1', role: 'tool', toolCallId: 's1', content: '{"selected":true}' },
      { id: 't2', role: 'tool', toolCallId: 'c1', content: '{"confirmed":false}' },
    ]);
    expect(restored.pending()).toEqual([]);
  });

  it('lists nothing before the agent starts', () => {
    expect(new FrontendCallLedger().pending()).toEqual([]);
  });
});
