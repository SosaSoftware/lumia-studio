import { describe, expect, it } from 'vitest';
import { SecretValue } from '@lumia/packages/lumi-env';
import type { LumiEnv } from '@lumia/packages/lumi-env';
import { BedrockModelFactory } from './bedrock-model-factory.ts';

const base: LumiEnv['model'] = { id: 'us.anthropic.claude-sonnet-4-6', temperature: 0.2, maxTokens: 16_384, guardrail: null, apiKey: null };

describe('BedrockModelFactory', () => {
  it('applies the model id, sampling, output limit and prompt caching', () => {
    const config = new BedrockModelFactory(base, 'us-east-1').create().getConfig();
    expect(config).toMatchObject({ modelId: 'us.anthropic.claude-sonnet-4-6', temperature: 0.2, maxTokens: 16_384, cacheConfig: { strategy: 'auto' } });
    expect(config.guardrailConfig).toBeUndefined();
  });

  it('leaves the temperature to the model when it is not set and applies a guardrail', () => {
    const config = new BedrockModelFactory({ ...base, temperature: null, guardrail: { id: 'gr-1', version: '3' } }, 'us-east-1').create().getConfig();
    expect(config.temperature).toBeUndefined();
    expect(config.guardrailConfig).toMatchObject({ guardrailIdentifier: 'gr-1', guardrailVersion: '3' });
  });

  it('keeps the API key out of the model configuration', () => {
    const config = new BedrockModelFactory({ ...base, apiKey: new SecretValue('bedrock-api-key-value') }, 'us-east-1').create().getConfig();
    expect(JSON.stringify(config)).not.toContain('bedrock-api-key-value');
  });

  it('creates a new model, with its own client, for each conversation', () => {
    const factory = new BedrockModelFactory(base, 'us-east-1');
    expect(factory.create()).not.toBe(factory.create());
  });
});
