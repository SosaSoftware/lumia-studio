import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LUMI_MCP_TOKEN_HEADER, DEFAULT_LUMI_MODEL_ID, LumiEnvError, SecretValue, parseLumiEnv } from './index.ts';

const LOCAL = {
  AWS_REGION: 'us-east-1',
  LUMI_MCP_URL: 'http://localhost:4100/mcp',
  LUMI_SESSION_DIR: '.sandbox/lumi/sessions',
  LUMI_MEMORY_DIR: '.sandbox/lumi/memory',
};

const REMOTE = {
  AWS_REGION: 'us-east-1',
  LUMI_MCP_URL: 'https://gateway.example.com/mcp',
  LUMI_SESSION_BUCKET: 'lumi-sessions-bucket',
  LUMI_MEMORY_ID: 'lumi_memory-abc123',
};

function issuesOf(source: Record<string, string | undefined>): readonly string[] {
  try {
    parseLumiEnv(source);
  } catch (error) {
    if (error instanceof LumiEnvError) return error.issues;
    throw error;
  }
  throw new Error('Expected a LumiEnvError');
}

describe('parseLumiEnv', () => {
  it('applies the defaults of a local run', () => {
    const env = parseLumiEnv(LOCAL);
    expect(env).toMatchObject({
      port: 8080,
      bindHost: '127.0.0.1',
      logLevel: 'info',
      region: 'us-east-1',
      model: { id: DEFAULT_LUMI_MODEL_ID, temperature: 0.2, maxTokens: 16_384, guardrail: null, apiKey: null },
      mcp: { url: 'http://localhost:4100/mcp', tokenHeader: DEFAULT_LUMI_MCP_TOKEN_HEADER },
      session: { kind: 'directory', dir: '.sandbox/lumi/sessions' },
      memory: { kind: 'directory', dir: '.sandbox/lumi/memory' },
      threadIdleMinutes: 30,
      devJwtSecret: null,
    });
  });

  it('reads the AWS storage and the model settings', () => {
    const env = parseLumiEnv({
      ...REMOTE,
      LUMI_PORT: '9000',
      LUMI_BIND_HOST: '0.0.0.0',
      LUMI_MODEL_ID: 'us.anthropic.claude-sonnet-4-6',
      LUMI_MODEL_TEMPERATURE: 'none',
      LUMI_MODEL_MAX_TOKENS: '8192',
      LUMI_GUARDRAIL_ID: 'gr-1',
      LUMI_GUARDRAIL_VERSION: '2',
      LUMI_SESSION_PREFIX: 'lumi',
    });
    expect(env.port).toBe(9000);
    expect(env.bindHost).toBe('0.0.0.0');
    expect(env.model).toMatchObject({ temperature: null, maxTokens: 8192, guardrail: { id: 'gr-1', version: '2' } });
    expect(env.session).toEqual({ kind: 's3', bucket: 'lumi-sessions-bucket', prefix: 'lumi' });
    expect(env.memory).toEqual({ kind: 'agentcore', memoryId: 'lumi_memory-abc123' });
  });

  it('treats empty values as unset', () => {
    const env = parseLumiEnv({ ...LOCAL, LUMI_PORT: '', BEDROCK_API_KEY: '  ', LUMI_SESSION_BUCKET: '' });
    expect(env.port).toBe(8080);
    expect(env.model.apiKey).toBeNull();
  });

  it('keeps secrets out of logs and JSON', () => {
    const env = parseLumiEnv({ ...LOCAL, BEDROCK_API_KEY: 'bedrock-key-value', LUMIA_DEV_JWT_SECRET: 'a-development-secret' });
    expect(env.model.apiKey?.reveal()).toBe('bedrock-key-value');
    expect(env.devJwtSecret?.reveal()).toBe('a-development-secret');
    const printed = `${JSON.stringify(env)} ${inspect(env, { depth: 5 })} ${String(env.model.apiKey)}`;
    expect(printed).not.toContain('bedrock-key-value');
    expect(printed).not.toContain('a-development-secret');
  });

  it('lists every invalid variable', () => {
    const issues = issuesOf({ AWS_REGION: 'virginia', LUMI_MCP_URL: 'ftp://host', LUMI_PORT: '70000', LUMI_MODEL_TEMPERATURE: '3' });
    expect(issues.join('\n')).toMatch(/AWS_REGION/);
    expect(issues.join('\n')).toMatch(/LUMI_MCP_URL/);
    expect(issues.join('\n')).toMatch(/LUMI_PORT/);
    expect(issues.join('\n')).toMatch(/LUMI_MODEL_TEMPERATURE/);
  });

  it('requires exactly one place for conversations and for preferences', () => {
    expect(issuesOf({ AWS_REGION: 'us-east-1', LUMI_MCP_URL: 'http://localhost/mcp' }).join('\n')).toMatch(/LUMI_SESSION_BUCKET.*LUMI_SESSION_DIR[\s\S]*LUMI_MEMORY_ID.*LUMI_MEMORY_DIR/);
    expect(issuesOf({ ...LOCAL, LUMI_SESSION_BUCKET: 'a-bucket' }).join('\n')).toMatch(/exactly one of LUMI_SESSION_BUCKET/);
    expect(issuesOf({ ...LOCAL, LUMI_MEMORY_ID: 'mem' }).join('\n')).toMatch(/exactly one of LUMI_MEMORY_ID/);
  });

  it('requires the guardrail id and version together', () => {
    expect(issuesOf({ ...LOCAL, LUMI_GUARDRAIL_ID: 'gr-1' }).join('\n')).toMatch(/LUMI_GUARDRAIL_VERSION/);
  });

  it('rejects a short development secret', () => {
    expect(issuesOf({ ...LOCAL, LUMIA_DEV_JWT_SECRET: 'short' }).join('\n')).toMatch(/LUMIA_DEV_JWT_SECRET: must have at least 16 characters/);
  });
});

describe('SecretValue', () => {
  it('only reveals the value on request', () => {
    const secret = new SecretValue('s3cr3t-value');
    expect(secret.reveal()).toBe('s3cr3t-value');
    expect(`${String(secret)} ${JSON.stringify({ secret })} ${inspect(secret)}`).not.toContain('s3cr3t-value');
  });
});
