import { record, text } from './decode.ts';

/**
 * Header that carries the person's Cognito access token from the gateway to the tool Lambdas.
 * The gateway target must allow it (`metadataConfiguration.allowedRequestHeaders`); the token never
 * goes in the tool arguments, so the model never sees it.
 */
export const STUDIO_TOKEN_HEADER = 'X-Amzn-Bedrock-AgentCore-Runtime-Custom-StudioToken';

/**
 * Argument the gateway interceptor may fill with the token when propagated headers do not reach Lambda targets.
 * It is removed before the tool validates its input and is never part of a tool schema.
 */
export const STUDIO_TOKEN_ARGUMENT = '_studio_token';

/** The gateway names tools `<target>___<tool>`. */
const TOOL_NAME_DELIMITER = '___';

/** The part of the Lambda context that AgentCore Gateway fills (`clientContext.custom`). */
export interface GatewayLambdaContext {
  readonly clientContext?: unknown;
}

export interface GatewayInvocation {
  /** Tool name without the target prefix. */
  readonly toolName: string;
  readonly args: Readonly<Record<string, unknown>>;
  /** The person's token, without `Bearer`; null when the gateway did not send it. */
  readonly token: string | null;
}

/** Reads a Lambda target invocation: the event holds the tool arguments, the context the tool name and the propagated headers. */
export function readInvocation(event: unknown, context: GatewayLambdaContext): GatewayInvocation {
  const clientContext = record(context.clientContext);
  // The Node runtime keeps the keys the gateway sends (`custom`); some typings spell it `Custom`.
  const custom = record(clientContext.custom ?? clientContext.Custom);
  const fullName = text(custom.bedrockAgentCoreToolName);
  const cut = fullName.indexOf(TOOL_NAME_DELIMITER);
  const { [STUDIO_TOKEN_ARGUMENT]: argumentToken, ...args } = record(event);
  return {
    toolName: cut === -1 ? fullName : fullName.slice(cut + TOOL_NAME_DELIMITER.length),
    args,
    token: tokenFrom(record(custom.bedrockAgentCorePropagatedHeaders)) ?? bare(argumentToken),
  };
}

function tokenFrom(headers: Record<string, unknown>): string | null {
  const wanted = STUDIO_TOKEN_HEADER.toLowerCase();
  const entry = Object.entries(headers).find(([name]) => name.toLowerCase() === wanted);
  return bare(entry?.[1]);
}

function bare(value: unknown): string | null {
  const token = text(value).replace(/^Bearer\s+/i, '').trim();
  return token === '' ? null : token;
}
