import { isProxyTool } from '@ag-ui/aws-strands';
import { AfterToolCallEvent, MessageAddedEvent } from '@strands-agents/sdk';
import type { LocalAgent, Message, Plugin } from '@strands-agents/sdk';
import { z } from 'zod';

/** A frontend tool call that Lumi made and the browser has not answered yet. */
export interface PendingFrontendCall {
  readonly toolUseId: string;
  readonly name: string;
}

/** Key of the ledger in `agent.appState`, which the session persists with the conversation. */
const STATE_KEY = 'lumi_frontend_calls';

/** Calls kept; older ones can no longer be answered by a browser that follows the protocol. */
const MAX_TRACKED = 50;

const TrackedCall = z.object({ toolUseId: z.string(), name: z.string(), placeholder: z.string().nullable() });
const TrackedCalls = z.array(TrackedCall);
type TrackedCall = z.infer<typeof TrackedCall>;

/** JSON of a tool result in the conversation, by tool use id. */
function resultsById(messages: readonly Message[]): Map<string, string> {
  const results = new Map<string, string>();
  for (const message of messages) {
    for (const block of message.content) {
      if (block.type === 'toolResultBlock') {
        results.set(block.toolUseId, JSON.stringify(block.content));
      }
    }
  }
  return results;
}

/**
 * Remembers the frontend tool calls that Lumi itself made, so only their answers are accepted from the browser.
 *
 * `@ag-ui/aws-strands` answers a frontend call with a placeholder and stops the run; the browser runs the tool and
 * sends the answer in the next request, and the adapter writes it over the placeholder. A call is pending while
 * its result in the conversation is still the placeholder that was saved.
 */
export class FrontendCallLedger implements Plugin {
  public readonly name = 'lumi:frontend-call-ledger';
  private agent: LocalAgent | undefined;

  public initAgent(agent: LocalAgent): void {
    this.agent = agent;
    agent.addHook(AfterToolCallEvent, (event) => {
      if (isProxyTool(event.tool)) {
        const tracked = this.read(event.agent).filter((call) => call.toolUseId !== event.toolUse.toolUseId);
        tracked.push({ toolUseId: event.toolUse.toolUseId, name: event.toolUse.name, placeholder: null });
        event.agent.appState.set(STATE_KEY, tracked.slice(-MAX_TRACKED));
      }
    });
    // The placeholder is read from the message that enters the conversation, after every hook had its say.
    agent.addHook(MessageAddedEvent, (event) => {
      const tracked = this.read(event.agent);
      if (!tracked.some((call) => call.placeholder === null)) {
        return;
      }
      const results = resultsById([event.message]);
      const updated = tracked.map((call) => (call.placeholder === null ? { ...call, placeholder: results.get(call.toolUseId) ?? null } : call));
      event.agent.appState.set(STATE_KEY, updated);
    });
  }

  /** Frontend calls of Lumi whose answer has not arrived, oldest first. */
  public pending(): PendingFrontendCall[] {
    const agent = this.agent;
    if (agent === undefined) {
      return [];
    }
    const results = resultsById(agent.messages);
    return this.read(agent)
      .filter((call) => call.placeholder !== null && results.get(call.toolUseId) === call.placeholder)
      .map(({ toolUseId, name }) => ({ toolUseId, name }));
  }

  private read(agent: LocalAgent): TrackedCall[] {
    const parsed = TrackedCalls.safeParse(agent.appState.get(STATE_KEY));
    return parsed.success ? parsed.data : [];
  }
}
