/**
 * Environment contract of Lumi, the co-creation agent of Lumia Studio.
 *
 * The agent reads its settings with {@link parseLumiEnv}; its infrastructure sets the same variables, named in
 * {@link LUMI_ENV}. This module has no relative imports so any toolchain of the repository can load it.
 */
import { z } from 'zod';

/** Names of the environment variables of Lumi. */
export const LUMI_ENV = {
  port: 'LUMI_PORT',
  bindHost: 'LUMI_BIND_HOST',
  logLevel: 'LUMI_LOG_LEVEL',
  region: 'AWS_REGION',
  modelId: 'LUMI_MODEL_ID',
  modelTemperature: 'LUMI_MODEL_TEMPERATURE',
  modelMaxTokens: 'LUMI_MODEL_MAX_TOKENS',
  guardrailId: 'LUMI_GUARDRAIL_ID',
  guardrailVersion: 'LUMI_GUARDRAIL_VERSION',
  bedrockApiKey: 'BEDROCK_API_KEY',
  mcpUrl: 'LUMI_MCP_URL',
  mcpTokenHeader: 'LUMI_MCP_TOKEN_HEADER',
  sessionBucket: 'LUMI_SESSION_BUCKET',
  sessionPrefix: 'LUMI_SESSION_PREFIX',
  sessionDir: 'LUMI_SESSION_DIR',
  memoryId: 'LUMI_MEMORY_ID',
  memoryDir: 'LUMI_MEMORY_DIR',
  threadIdleMinutes: 'LUMI_THREAD_IDLE_MINUTES',
  devJwtSecret: 'LUMIA_DEV_JWT_SECRET',
} as const;

/** Model of Lumi when `LUMI_MODEL_ID` is not set: Claude Sonnet 4.6 through the US inference profile. */
export const DEFAULT_LUMI_MODEL_ID = 'us.anthropic.claude-sonnet-4-6';

/**
 * Header that carries the token of the person from Lumi to the tools behind AgentCore Gateway. The gateway
 * targets propagate it (`metadataConfiguration.allowedRequestHeaders`), so the token never enters a prompt.
 */
export const DEFAULT_LUMI_MCP_TOKEN_HEADER = 'X-Amzn-Bedrock-AgentCore-Runtime-Custom-StudioToken';

/**
 * AgentCore Memory namespace where the preferences of each person are extracted and read. The user preference
 * strategy of the memory resource must use the same template; AgentCore fills `{actorId}` with the key of the
 * person that Lumi sends.
 */
export const LUMI_MEMORY_PREFERENCES_NAMESPACE = '/users/{actorId}/preferences';

/** Log levels of Lumi, from most to least verbose. */
export type LumiLogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * A secret read from the environment. It prints as `[redacted]` in logs, `JSON.stringify` and `util.inspect`;
 * only {@link SecretValue.reveal} returns the value.
 */
export class SecretValue {
  // A `#` field, unlike a TypeScript `private` one, is invisible to serializers and inspectors.
  readonly #value: string;

  public constructor(value: string) {
    this.#value = value;
  }

  /** The secret itself; pass it straight to the client that needs it. */
  public reveal(): string {
    return this.#value;
  }

  public toString(): string {
    return '[redacted]';
  }

  public toJSON(): string {
    return '[redacted]';
  }

  public [Symbol.for('nodejs.util.inspect.custom')](): string {
    return '[redacted]';
  }
}

/** Where conversations are kept: an S3 bucket in AWS, a directory locally. */
export type LumiSessionStorage = { readonly kind: 's3'; readonly bucket: string; readonly prefix: string } | { readonly kind: 'directory'; readonly dir: string };

/** Where the preferences of each person are kept: AgentCore Memory in AWS, a directory locally. */
export type LumiMemoryStorage = { readonly kind: 'agentcore'; readonly memoryId: string } | { readonly kind: 'directory'; readonly dir: string };

/** Settings of Lumi, validated and typed. */
export interface LumiEnv {
  readonly port: number;
  readonly bindHost: string;
  readonly logLevel: LumiLogLevel;
  readonly region: string;
  readonly model: {
    readonly id: string;
    /** Sampling temperature; null leaves the model default. */
    readonly temperature: number | null;
    readonly maxTokens: number;
    readonly guardrail: { readonly id: string; readonly version: string } | null;
    /** Bedrock API key; null uses the AWS credential chain. */
    readonly apiKey: SecretValue | null;
  };
  readonly mcp: { readonly url: string; readonly tokenHeader: string };
  readonly session: LumiSessionStorage;
  readonly memory: LumiMemoryStorage;
  readonly threadIdleMinutes: number;
  /** Secret of the sandbox development tokens; only the local entry point uses it. */
  readonly devJwtSecret: SecretValue | null;
}

/** Raised when the environment does not satisfy the contract; the message lists every problem. */
export class LumiEnvError extends Error {
  public constructor(public readonly issues: readonly string[]) {
    super(`Invalid Lumi environment:\n${issues.map((issue) => `- ${issue}`).join('\n')}`);
    this.name = 'LumiEnvError';
  }
}

const REGION = /^[a-z]{2}(-[a-z]+)+-\d+$/;
const HEADER_NAME = /^[A-Za-z0-9-]+$/;
const S3_BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

const text = z.string().min(1);

const RawLumiEnv = z.object({
  [LUMI_ENV.port]: z.coerce.number().int().min(1).max(65_535).default(8080),
  [LUMI_ENV.bindHost]: text.default('127.0.0.1'),
  [LUMI_ENV.logLevel]: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  [LUMI_ENV.region]: z.string().regex(REGION, 'must be an AWS region such as us-east-1'),
  [LUMI_ENV.modelId]: text.default(DEFAULT_LUMI_MODEL_ID),
  [LUMI_ENV.modelTemperature]: z.union([z.literal('none'), z.coerce.number().min(0).max(1)]).default(0.2),
  // Bedrock reserves the maximum output against the tokens-per-minute quota, so it stays bounded.
  [LUMI_ENV.modelMaxTokens]: z.coerce.number().int().min(256).max(128_000).default(16_384),
  [LUMI_ENV.guardrailId]: text.optional(),
  [LUMI_ENV.guardrailVersion]: text.optional(),
  [LUMI_ENV.bedrockApiKey]: text.optional(),
  [LUMI_ENV.mcpUrl]: z.url({ protocol: /^https?$/, error: 'must be an http or https URL' }),
  [LUMI_ENV.mcpTokenHeader]: z.string().regex(HEADER_NAME, 'must be an HTTP header name').default(DEFAULT_LUMI_MCP_TOKEN_HEADER),
  [LUMI_ENV.sessionBucket]: z.string().regex(S3_BUCKET, 'must be an S3 bucket name').optional(),
  [LUMI_ENV.sessionPrefix]: text.default('sessions'),
  [LUMI_ENV.sessionDir]: text.optional(),
  [LUMI_ENV.memoryId]: text.optional(),
  [LUMI_ENV.memoryDir]: text.optional(),
  [LUMI_ENV.threadIdleMinutes]: z.coerce.number().int().min(1).max(1440).default(30),
  [LUMI_ENV.devJwtSecret]: z.string().min(16, 'must have at least 16 characters').optional(),
});

type RawLumiEnv = z.infer<typeof RawLumiEnv>;

/** Empty values count as unset, as an empty line in an `.env` file would mean. */
function normalize(source: Readonly<Record<string, string | undefined>>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of Object.values(LUMI_ENV)) {
    const value = source[name]?.trim();
    if (value !== undefined && value !== '') {
      result[name] = value;
    }
  }
  return result;
}

function sessionStorage(env: RawLumiEnv, issues: string[]): LumiSessionStorage | null {
  const bucket = env[LUMI_ENV.sessionBucket];
  const dir = env[LUMI_ENV.sessionDir];
  if (bucket !== undefined && dir === undefined) {
    return { kind: 's3', bucket, prefix: env[LUMI_ENV.sessionPrefix] };
  }
  if (dir !== undefined && bucket === undefined) {
    return { kind: 'directory', dir };
  }
  issues.push(`${LUMI_ENV.sessionBucket}: set exactly one of ${LUMI_ENV.sessionBucket} or ${LUMI_ENV.sessionDir} (where conversations are kept)`);
  return null;
}

function memoryStorage(env: RawLumiEnv, issues: string[]): LumiMemoryStorage | null {
  const memoryId = env[LUMI_ENV.memoryId];
  const dir = env[LUMI_ENV.memoryDir];
  if (memoryId !== undefined && dir === undefined) {
    return { kind: 'agentcore', memoryId };
  }
  if (dir !== undefined && memoryId === undefined) {
    return { kind: 'directory', dir };
  }
  issues.push(`${LUMI_ENV.memoryId}: set exactly one of ${LUMI_ENV.memoryId} or ${LUMI_ENV.memoryDir} (where preferences are kept)`);
  return null;
}

function guardrail(env: RawLumiEnv, issues: string[]): LumiEnv['model']['guardrail'] {
  const id = env[LUMI_ENV.guardrailId];
  const version = env[LUMI_ENV.guardrailVersion];
  if (id !== undefined && version !== undefined) {
    return { id, version };
  }
  if (id !== undefined || version !== undefined) {
    issues.push(`${LUMI_ENV.guardrailId}: set both ${LUMI_ENV.guardrailId} and ${LUMI_ENV.guardrailVersion}, or neither`);
  }
  return null;
}

/**
 * Reads and validates the settings of Lumi.
 *
 * @param source - The environment, usually `process.env`.
 * @returns The typed settings.
 * @throws LumiEnvError when a variable is missing, invalid or inconsistent with another one.
 */
export function parseLumiEnv(source: Readonly<Record<string, string | undefined>>): LumiEnv {
  const parsed = RawLumiEnv.safeParse(normalize(source));
  if (!parsed.success) {
    throw new LumiEnvError(parsed.error.issues.map((issue) => `${issue.path.map(String).join('.') || 'environment'}: ${issue.message}`));
  }
  const env = parsed.data;
  const issues: string[] = [];
  const session = sessionStorage(env, issues);
  const memory = memoryStorage(env, issues);
  const modelGuardrail = guardrail(env, issues);
  if (session === null || memory === null || issues.length > 0) {
    throw new LumiEnvError(issues);
  }
  const temperature = env[LUMI_ENV.modelTemperature];
  const apiKey = env[LUMI_ENV.bedrockApiKey];
  const devJwtSecret = env[LUMI_ENV.devJwtSecret];
  return {
    port: env[LUMI_ENV.port],
    bindHost: env[LUMI_ENV.bindHost],
    logLevel: env[LUMI_ENV.logLevel],
    region: env[LUMI_ENV.region],
    model: {
      id: env[LUMI_ENV.modelId],
      temperature: temperature === 'none' ? null : temperature,
      maxTokens: env[LUMI_ENV.modelMaxTokens],
      guardrail: modelGuardrail,
      apiKey: apiKey === undefined ? null : new SecretValue(apiKey),
    },
    mcp: { url: env[LUMI_ENV.mcpUrl], tokenHeader: env[LUMI_ENV.mcpTokenHeader] },
    session,
    memory,
    threadIdleMinutes: env[LUMI_ENV.threadIdleMinutes],
    devJwtSecret: devJwtSecret === undefined ? null : new SecretValue(devJwtSecret),
  };
}
