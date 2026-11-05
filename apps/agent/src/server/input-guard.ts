import type { Message, RunAgentInput, Tool, ToolMessage, UserMessage } from '@ag-ui/core';
import type { PendingFrontendCall } from '../interventions/frontend-call-ledger.ts';
import type { ScreenContext } from './screen-context.ts';

/** Why a request cannot run, with the HTTP status that says so. */
export class InputRejectedError extends Error {
  public constructor(
    message: string,
    public readonly status: 400 | 413,
  ) {
    super(message);
    this.name = 'InputRejectedError';
  }
}

/** A request reduced to what Lumi accepts from the browser. */
export interface GuardedRun {
  /** `message` when the person wrote; `answers` when the browser only answered frontend calls. */
  readonly kind: 'message' | 'answers';
  readonly input: RunAgentInput;
}

export interface InputGuardLimits {
  readonly maxMessageChars: number;
  readonly maxAnswerChars: number;
  readonly maxTools: number;
}

const DEFAULT_LIMITS: InputGuardLimits = { maxMessageChars: 50_000, maxAnswerChars: 20_000, maxTools: 32 };

/** Names Bedrock accepts for tools. */
const TOOL_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

/** What Lumi records for a frontend call that the browser left without an answer. */
const UNANSWERED = JSON.stringify({ answered: false, reason: 'The browser did not answer this call before the next request.' });

/**
 * Keeps from a `RunAgentInput` only what the browser is entitled to say.
 *
 * The conversation lives on the server, in the session of the person, so the history that AG-UI clients resend is
 * dropped: a client cannot add or rewrite turns, invent tool results or seed a new thread. What stays is the new
 * message of the person (text only) and the answers to the frontend calls that Lumi made and is still waiting
 * for, matched by tool call id. A pending call without an answer gets an explicit "not answered" result, so
 * the model never waits on a call that will not be answered. The screen context is sanitized, and the declared
 * frontend tools are kept within limits; shared state, forwarded props and resume payloads are not used by Lumi.
 */
export class InputGuard {
  public constructor(
    private readonly screen: ScreenContext,
    private readonly limits: InputGuardLimits = DEFAULT_LIMITS,
  ) {}

  /**
   * @param input - The validated input of the request.
   * @param threadId - Thread id the adapter runs under, which also names the person.
   * @param pending - Frontend calls of Lumi still waiting for the browser, oldest first.
   * @throws InputRejectedError when the request carries nothing Lumi can run.
   */
  public guard(input: RunAgentInput, threadId: string, pending: readonly PendingFrontendCall[]): GuardedRun {
    const answers = this.answersTo(input.messages, pending);
    const answered: ToolMessage[] = pending.map((call) => answers.get(call.toolUseId) ?? InputGuard.unanswered(call));
    const last = input.messages.at(-1);
    let kind: GuardedRun['kind'];
    let messages: Message[];
    if (last?.role === 'user') {
      kind = 'message';
      messages = [...answered, this.personMessage(last)];
    } else if (last?.role === 'tool' && answers.size > 0) {
      kind = 'answers';
      messages = answered;
    } else {
      throw new InputRejectedError('The request has no new message and answers no pending call of Lumi.', 400);
    }
    return {
      kind,
      input: {
        threadId,
        runId: input.runId,
        state: {},
        messages,
        tools: this.tools(input.tools),
        context: this.screen.sanitize(input.context),
        forwardedProps: {},
      },
    };
  }

  /** The last answer the browser gave to each pending call. */
  private answersTo(messages: readonly Message[], pending: readonly PendingFrontendCall[]): Map<string, ToolMessage> {
    const waiting = new Set(pending.map((call) => call.toolUseId));
    const answers = new Map<string, ToolMessage>();
    for (const message of messages) {
      if (message.role === 'tool' && waiting.has(message.toolCallId)) {
        const content = InputGuard.textOf(message.content);
        if (content.length > this.limits.maxAnswerChars) {
          throw new InputRejectedError('A tool answer is too long.', 413);
        }
        answers.set(message.toolCallId, { id: message.id, role: 'tool', toolCallId: message.toolCallId, content });
      }
    }
    return answers;
  }

  private personMessage(message: UserMessage): UserMessage {
    const text = InputGuard.textOf(message.content).trim();
    if (text === '') {
      throw new InputRejectedError('The message has no text.', 400);
    }
    if (text.length > this.limits.maxMessageChars) {
      throw new InputRejectedError(`The message is longer than ${String(this.limits.maxMessageChars)} characters.`, 413);
    }
    return { id: message.id, role: 'user', content: text };
  }

  private tools(declared: readonly Tool[]): Tool[] {
    const byName = new Map<string, Tool>();
    for (const tool of declared) {
      if (TOOL_NAME.test(tool.name) && !byName.has(tool.name)) {
        byName.set(tool.name, tool);
      }
    }
    return [...byName.values()].slice(0, this.limits.maxTools);
  }

  /** The text of a message; images, audio, video and documents are not taken from the browser. */
  private static textOf(content: string | readonly { readonly type: string; readonly text?: string }[]): string {
    return typeof content === 'string' ? content : content.flatMap((part) => (part.type === 'text' && part.text !== undefined ? [part.text] : [])).join('\n');
  }

  private static unanswered(call: PendingFrontendCall): ToolMessage {
    return { id: `lumi-unanswered-${call.toolUseId}`, role: 'tool', toolCallId: call.toolUseId, content: UNANSWERED };
  }
}
