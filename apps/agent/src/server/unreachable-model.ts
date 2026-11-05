import { Model } from '@strands-agents/sdk';
import type { BaseModelConfig, ModelStreamEvent } from '@strands-agents/sdk';

/** Raised if the adapter ever runs its template agent instead of the agent of a conversation. */
export class TemplateAgentRunError extends Error {
  public constructor() {
    super('The template agent of the AG-UI adapter ran; every run must use the agent of its conversation.');
    this.name = 'TemplateAgentRunError';
  }
}

/**
 * Model of the template agent that `@ag-ui/aws-strands` requires. Lumi always provides the agent of each
 * conversation through `agentsByThread`, so the template must never reach a model: this one fails the run instead
 * of answering with the wrong tools, session or identity.
 */
export class UnreachableModel extends Model {
  private config: BaseModelConfig = { modelId: 'unreachable' };

  public override updateConfig(modelConfig: BaseModelConfig): void {
    this.config = { ...this.config, ...modelConfig };
  }

  public override getConfig(): BaseModelConfig {
    return this.config;
  }

  public override stream(): AsyncIterable<ModelStreamEvent> {
    return {
      [Symbol.asyncIterator]: () => ({
        next: () => Promise.reject(new TemplateAgentRunError()),
      }),
    };
  }
}
