import { InterventionActions, InterventionHandler } from '@strands-agents/sdk';
import type { AfterToolCallEvent, BeforeToolCallEvent, LocalAgent, Message, OnError } from '@strands-agents/sdk';
import { z } from 'zod';
import type { Logger } from '../shared/logger.ts';
import type { ConfirmationPolicy } from './confirmation-policy.ts';
import type { JsonObject } from './conversation-reading.ts';
import { canonicalJson, toolResultJson, translateIds, turnStart } from './conversation-reading.ts';

type Proceed = ReturnType<typeof InterventionActions.proceed>;
type Guide = ReturnType<typeof InterventionActions.guide>;

/** Key of the gate's state in `agent.appState`, which the session persists with the conversation. */
const STATE_KEY = 'lumi_consent';

const ProposedChange = z.object({
  action: z.string().min(1),
  summary: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()),
});

/** What the browser answers to a confirmation: `confirmed`, plus `error` when it could not ask. */
const ConfirmAnswer = z.object({ confirmed: z.boolean(), error: z.string().optional() });

/** What a Studio write adds to its answer when it had to create the draft: the ids that changed. */
const DraftNotice = z.object({ draft: z.object({ idMap: z.record(z.string(), z.string()) }) });

const ConsentState = z.object({
  /** Tracking id of the message that opened the turn. */
  turn: z.string(),
  /** Approved changes already run, as `<confirmation tool use id>#<change index>`. */
  used: z.array(z.string()),
  /** Ids replaced by the draft created in this turn: published id → draft id. */
  idMap: z.record(z.string(), z.string()),
});
type ConsentState = z.infer<typeof ConsentState>;

interface ApprovedChange {
  readonly key: string;
  readonly action: string;
  readonly arguments: JsonObject;
}

/** What the turn says about the confirmations asked in it. */
interface TurnConsent {
  readonly approved: readonly ApprovedChange[];
  readonly declined: boolean;
}

const FEEDBACK = {
  declined: 'Not done: the person declined a change in this turn. Make no changes until they write again.',
  needsConsent:
    "Not done: this change needs the person's consent. Call confirm_change with this exact action and arguments, wait for the answer, then run it once. A confirmation covers exactly the arguments it shows.",
} as const;

/**
 * Lets a change to Studio run only after the person accepted it, in the same turn and with the same arguments.
 *
 * Lumi asks with the frontend tool `confirm_change`, listing each change as the exact tool and arguments it will
 * run. The gate then admits a write only when an accepted confirmation of the current turn holds that change; each
 * accepted change runs once. Ids that changed because the write created the draft are translated with its
 * `idMap`. Everything the gate reads comes from the server-side conversation: the confirmations are Lumi's own
 * tool calls and the answers are the browser's results for those calls, so the client cannot forge an approval.
 *
 * A write in the same model response as its confirmation finds no answer yet and is held back; after a decline,
 * nothing else changes in that turn. A turn lasts from a message of the person to the end of Lumi's work on it.
 *
 * The confirmation itself always proceeds: the AG-UI adapter streams a frontend call to the browser before any
 * intervention runs, so holding it back here would leave the browser asking a question the model believes was
 * never asked. A malformed confirmation simply grants nothing, and the browser answers it with an `error`.
 */
export class ConfirmationGate extends InterventionHandler {
  public readonly name = 'lumi:confirmation-gate';
  /** A failure of the gate denies the call: consent is never skipped because of a bug. */
  public override readonly onError: OnError = 'deny';
  private readonly requestSchema;

  public constructor(
    private readonly policy: ConfirmationPolicy,
    private readonly logger: Logger,
  ) {
    super();
    this.requestSchema = z.object({ message: z.string().min(1), changes: z.array(ProposedChange).min(1).max(policy.maxChanges) });
  }

  public override beforeToolCall(event: BeforeToolCallEvent): Proceed | Guide {
    if (!this.policy.needsConsent(event.toolUse.name)) {
      return InterventionActions.proceed();
    }
    return this.reviewChange(event);
  }

  public override afterToolCall(event: AfterToolCallEvent): Proceed {
    if (this.policy.needsConsent(event.toolUse.name) && event.result.status === 'success') {
      const notice = DraftNotice.safeParse(toolResultJson(event.result));
      if (notice.success) {
        const state = this.load(event.agent);
        this.save(event.agent, { ...state, idMap: { ...state.idMap, ...notice.data.draft.idMap } });
      }
    }
    return InterventionActions.proceed();
  }

  private reviewChange(event: BeforeToolCallEvent): Proceed | Guide {
    const consent = this.consentOfTurn(event.agent.messages);
    if (consent.declined) {
      return this.hold(event, 'declined in this turn', FEEDBACK.declined);
    }
    const { name, input } = event.toolUse;
    const state = this.load(event.agent);
    const wanted = canonicalJson(input);
    const match = consent.approved.find(
      (change) =>
        change.action === name &&
        !state.used.includes(change.key) &&
        (canonicalJson(change.arguments) === wanted || canonicalJson(translateIds(change.arguments, state.idMap)) === wanted),
    );
    if (match === undefined) {
      return this.hold(event, 'no matching consent', FEEDBACK.needsConsent);
    }
    // Read and write happen in one synchronous step, so two calls of one response cannot spend the same approval.
    this.save(event.agent, { ...state, used: [...state.used, match.key] });
    this.logger.info('Change approved by the person', { tool: name, consent: match.key });
    return InterventionActions.proceed({ reason: `approved by ${match.key}` });
  }

  /** The confirmations of the current turn and the answers of the person. */
  private consentOfTurn(messages: readonly Message[]): TurnConsent {
    const start = turnStart(messages);
    if (start === -1) {
      return { approved: [], declined: false };
    }
    const requests = new Map<string, z.infer<typeof ProposedChange>[]>();
    const answers = new Map<string, z.infer<typeof ConfirmAnswer>>();
    for (const message of messages.slice(start + 1)) {
      for (const block of message.content) {
        if (block.type === 'toolUseBlock' && block.name === this.policy.confirmationTool) {
          const request = this.requestSchema.safeParse(block.input);
          if (request.success) {
            requests.set(block.toolUseId, request.data.changes);
          }
        } else if (block.type === 'toolResultBlock') {
          const answer = ConfirmAnswer.safeParse(toolResultJson(block));
          if (answer.success) {
            answers.set(block.toolUseId, answer.data);
          }
        }
      }
    }
    const approved: ApprovedChange[] = [];
    let declined = false;
    for (const [toolUseId, changes] of requests) {
      const answer = answers.get(toolUseId);
      if (answer?.confirmed === true) {
        changes.forEach((change, index) => {
          approved.push({ key: `${toolUseId}#${String(index)}`, action: change.action, arguments: change.arguments });
        });
      } else if (answer?.confirmed === false && answer.error === undefined) {
        // An answer with `error` means the browser could not ask; Lumi may fix the request and ask again.
        declined = true;
      }
    }
    return { approved, declined };
  }

  private hold(event: BeforeToolCallEvent, reason: string, feedback: string): Guide {
    this.logger.info('Change held back', { tool: event.toolUse.name, reason });
    return InterventionActions.guide(feedback, { reason });
  }

  /** The state of the current turn; a new turn starts clean. */
  private load(agent: LocalAgent): ConsentState {
    const start = turnStart(agent.messages);
    const turn = start === -1 ? '' : (agent.messages[start]?.trackingId ?? '');
    const stored = ConsentState.safeParse(agent.appState.get(STATE_KEY));
    return stored.success && stored.data.turn === turn ? stored.data : { turn, used: [], idMap: {} };
  }

  private save(agent: LocalAgent, state: ConsentState): void {
    agent.appState.set(STATE_KEY, state);
  }
}
