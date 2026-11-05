import { BeforeInvocationEvent, Message, TextBlock } from '@strands-agents/sdk';
import type { LocalAgent, Plugin } from '@strands-agents/sdk';

/** What Lumi "said" in a turn that ended before it could answer. */
export const UNFINISHED_TURN_REPLY = '(This turn ended before I could reply.)';

/**
 * Closes a turn that ended without a reply before the next message of the person enters the conversation.
 *
 * A turn can end on a user message: the model failed (throttling, an outage), or the person wrote while a screen
 * call was still waiting and the input guard answered it as not answered. The next message would then follow
 * another user message, and models expect user and assistant turns to alternate. A short assistant message closes
 * the earlier turn, as the Strands SDK itself does for a cancelled one. It also keeps the start of the new turn
 * clear for the confirmation gate.
 */
export class UnfinishedTurnCloser implements Plugin {
  public readonly name = 'lumi:unfinished-turn-closer';

  public initAgent(agent: LocalAgent): void {
    agent.addHook(BeforeInvocationEvent, (event) => {
      const startsTurn = event.messages.some((message) => message.role === 'user');
      if (startsTurn && event.agent.messages.at(-1)?.role === 'user') {
        // Added directly, so no message hook runs for it; the session saves it with the next message.
        event.agent.messages.push(new Message({ role: 'assistant', content: [new TextBlock(UNFINISHED_TURN_REPLY)] }));
      }
    });
  }
}
