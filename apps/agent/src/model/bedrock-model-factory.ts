import type { Model } from '@strands-agents/sdk';
import { BedrockModel } from '@strands-agents/sdk/models/bedrock';
import type { BedrockModelOptions } from '@strands-agents/sdk/models/bedrock';
import type { LumiEnv } from '@lumia/packages/lumi-env';

/** Builds the model of each conversation. */
export interface ModelProvider {
  create(): Model;
}

/**
 * The SDK signs every Bedrock request with SigV4 before its API key middleware replaces the signature, so signing
 * needs credentials even when an API key authenticates the call. These placeholders are never accepted by AWS.
 */
const API_KEY_SIGNING_CREDENTIALS = { accessKeyId: 'bedrock-api-key', secretAccessKey: 'bedrock-api-key' };

/**
 * Creates the Bedrock model of Lumi: the model id and sampling settings come from the environment, prompt caching
 * is on (`auto` adds cache points only where the model supports them) and a guardrail applies when configured.
 *
 * A new model, with its own Bedrock client, is created for each conversation: AgentCore Runtime expects SDK
 * clients to be created while serving the session rather than when the process starts.
 */
export class BedrockModelFactory implements ModelProvider {
  public constructor(
    private readonly settings: LumiEnv['model'],
    private readonly region: string,
  ) {}

  public create(): BedrockModel {
    const { id, temperature, maxTokens, guardrail, apiKey } = this.settings;
    const options: BedrockModelOptions = {
      modelId: id,
      region: this.region,
      maxTokens,
      cacheConfig: { strategy: 'auto' },
      ...(temperature === null ? {} : { temperature }),
      ...(guardrail === null ? {} : { guardrailConfig: { guardrailIdentifier: guardrail.id, guardrailVersion: guardrail.version, guardLatestUserMessage: true } }),
      ...(apiKey === null ? {} : { apiKey: apiKey.reveal(), clientConfig: { credentials: API_KEY_SIGNING_CREDENTIALS } }),
    };
    return new BedrockModel(options);
  }
}
