import { randomUUID } from 'node:crypto';
import { HttpAgent } from '@ag-ui/client';
import { EventType } from '@ag-ui/core';
import type { BaseEvent, Context, Tool } from '@ag-ui/core';

/** A tool call that Lumi made during a turn. */
export interface ObservedCall {
  readonly id: string;
  readonly name: string;
  /** Whether the browser runs it (a declared frontend tool). */
  readonly frontend: boolean;
  rawArgs: string;
  args: unknown;
  /** Result as the stream reported it, or as the browser answered. */
  result: string | undefined;
}

/** What one turn of the person produced. */
export interface TurnResult {
  readonly prompt: string;
  /** Visible text of Lumi, in order. */
  readonly text: string;
  readonly calls: readonly ObservedCall[];
  /** Run errors and failures of the simulated browser. */
  readonly errors: readonly string[];
  /** Runs it took, one per round of frontend calls. */
  readonly rounds: number;
}

/** How the simulated browser answers a frontend call. */
export type FrontendAnswer = (call: ObservedCall) => unknown;

export interface BrowserSimulatorOptions {
  /** AG-UI endpoint of Lumi (`/invocations`). */
  readonly url: string;
  /** Development token of the person. */
  readonly token: string;
  readonly tools: readonly Tool[];
  /** Screen context of each run, read when the run starts. */
  readonly context: () => Context[];
  readonly answer: FrontendAnswer;
  /** Runs per turn before giving up, as the web does. */
  readonly maxRounds?: number;
}

function field(event: BaseEvent, name: string): unknown {
  return Object.entries(event).find(([key]) => key === name)?.[1];
}

function textField(event: BaseEvent, name: string): string {
  const value = field(event, name);
  return typeof value === 'string' ? value : '';
}

/**
 * Plays the web against Lumi: the AG-UI `HttpAgent` of the web, the frontend tools it declares and the screen
 * context it sends. A turn sends the message of the person, answers every frontend call with `answer` and runs again
 * until a run ends without calls waiting, at most `maxRounds` times. One simulator is one conversation.
 */
export class BrowserSimulator {
  private readonly agent: HttpAgent;
  private readonly frontendTools: ReadonlySet<string>;

  public constructor(private readonly options: BrowserSimulatorOptions) {
    this.agent = new HttpAgent({ url: options.url, threadId: randomUUID(), headers: { Authorization: `Bearer ${options.token}` } });
    this.frontendTools = new Set(options.tools.map((tool) => tool.name));
  }

  public async turn(prompt: string): Promise<TurnResult> {
    const calls: ObservedCall[] = [];
    const errors: string[] = [];
    const texts: string[] = [];
    let rounds = 0;
    this.agent.addMessage({ id: randomUUID(), role: 'user', content: prompt });
    for (;;) {
      rounds += 1;
      const roundCalls: ObservedCall[] = [];
      let current = '';
      try {
        await this.agent.runAgent(
          { tools: this.options.tools.map((tool) => ({ ...tool })), context: this.options.context() },
          {
            onEvent: ({ event }) => {
              switch (event.type) {
                case EventType.TEXT_MESSAGE_START:
                  current = '';
                  break;
                case EventType.TEXT_MESSAGE_CONTENT:
                  current += textField(event, 'delta');
                  break;
                case EventType.TEXT_MESSAGE_END:
                  if (current.trim() !== '') texts.push(current.trim());
                  current = '';
                  break;
                case EventType.TOOL_CALL_START: {
                  const name = textField(event, 'toolCallName');
                  roundCalls.push({ id: textField(event, 'toolCallId'), name, frontend: this.frontendTools.has(name), rawArgs: '', args: undefined, result: undefined });
                  break;
                }
                case EventType.TOOL_CALL_ARGS: {
                  const call = roundCalls.find((candidate) => candidate.id === textField(event, 'toolCallId'));
                  if (call !== undefined) call.rawArgs += textField(event, 'delta');
                  break;
                }
                case EventType.TOOL_CALL_END: {
                  const call = roundCalls.find((candidate) => candidate.id === textField(event, 'toolCallId'));
                  if (call !== undefined) call.args = BrowserSimulator.parse(call.rawArgs);
                  break;
                }
                case EventType.TOOL_CALL_RESULT: {
                  const call = roundCalls.find((candidate) => candidate.id === textField(event, 'toolCallId'));
                  if (call !== undefined) call.result = textField(event, 'content');
                  break;
                }
                case EventType.RUN_ERROR:
                  errors.push(`RUN_ERROR ${textField(event, 'code')}: ${textField(event, 'message')}`);
                  break;
                default:
                  break;
              }
            },
          },
        );
      } catch (error) {
        errors.push(`Run failed: ${error instanceof Error ? error.message : String(error)}`);
        calls.push(...roundCalls);
        break;
      }
      calls.push(...roundCalls);
      const pending = roundCalls.filter((call) => call.frontend && call.result === undefined);
      if (pending.length === 0) {
        break;
      }
      if (rounds >= (this.options.maxRounds ?? 8)) {
        errors.push(`The turn did not finish in ${String(rounds)} runs.`);
        break;
      }
      for (const call of pending) {
        call.result = JSON.stringify(this.options.answer(call));
        this.agent.addMessage({ id: randomUUID(), role: 'tool', toolCallId: call.id, content: call.result });
      }
    }
    return { prompt, text: texts.join('\n\n'), calls, errors, rounds };
  }

  private static parse(raw: string): unknown {
    if (raw.trim() === '') {
      return {};
    }
    try {
      return JSON.parse(raw);
    } catch {
      // Malformed arguments stay unparsed; checks read `rawArgs`.
      return undefined;
    }
  }
}
