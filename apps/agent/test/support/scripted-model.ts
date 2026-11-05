import { Model } from '@strands-agents/sdk';
import type { BaseModelConfig, JSONValue, Message, ModelStreamEvent } from '@strands-agents/sdk';

/** A text block or a tool use in a scripted reply. */
export type ScriptedBlock = { readonly text: string } | { readonly tool: string; readonly input: JSONValue; readonly id?: string };

/** One scripted model reply: fixed blocks, or blocks computed from the conversation the model receives. */
export type ScriptedStep = readonly ScriptedBlock[] | ((messages: readonly Message[]) => readonly ScriptedBlock[]);

/** Raised when the agent asks the model for more replies than the script has. */
export class ScriptExhaustedError extends Error {
  public constructor(calls: number) {
    super(`The scripted model has no reply for call ${String(calls)}.`);
    this.name = 'ScriptExhaustedError';
  }
}

/**
 * Model that streams scripted replies, so tests run the real agent loop without Bedrock.
 *
 * Each call to the model takes the next step. A reply with tool uses stops with `toolUse`; any other
 * reply ends the turn.
 */
export class ScriptedModel extends Model {
  /** The conversation the agent sent on each call, in order. */
  public readonly calls: Message[][] = [];
  private config: BaseModelConfig = { modelId: 'scripted' };
  private toolUses = 0;

  public constructor(private readonly steps: readonly ScriptedStep[]) {
    super();
  }

  public override updateConfig(modelConfig: BaseModelConfig): void {
    this.config = { ...this.config, ...modelConfig };
  }

  public override getConfig(): BaseModelConfig {
    return this.config;
  }

  public override async *stream(messages: Message[]): AsyncIterable<ModelStreamEvent> {
    this.calls.push([...messages]);
    const step = this.steps[this.calls.length - 1];
    if (step === undefined) {
      throw new ScriptExhaustedError(this.calls.length);
    }
    const blocks = typeof step === 'function' ? step(messages) : step;
    // Keeps the generator asynchronous like a real provider, so the loop interleaves as it does in production.
    await Promise.resolve();
    yield { type: 'modelMessageStartEvent', role: 'assistant' };
    let usesTools = false;
    for (const block of blocks) {
      if ('text' in block) {
        yield { type: 'modelContentBlockStartEvent' };
        yield { type: 'modelContentBlockDeltaEvent', delta: { type: 'textDelta', text: block.text } };
      } else {
        usesTools = true;
        this.toolUses += 1;
        const toolUseId = block.id ?? `tooluse_scripted_${String(this.toolUses)}`;
        yield { type: 'modelContentBlockStartEvent', start: { type: 'toolUseStart', name: block.tool, toolUseId } };
        yield { type: 'modelContentBlockDeltaEvent', delta: { type: 'toolUseInputDelta', input: JSON.stringify(block.input) } };
      }
      yield { type: 'modelContentBlockStopEvent' };
    }
    yield { type: 'modelMessageStopEvent', stopReason: usesTools ? 'toolUse' : 'endTurn' };
  }
}
