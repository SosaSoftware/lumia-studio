import { Logger } from '../shared/log/index.ts';
import type { GatewayLambdaContext } from './gateway-invocation.ts';
import { STUDIO_TOKEN_HEADER, readInvocation } from './gateway-invocation.ts';
import type { FetchFunction } from './studio-graphql.ts';
import { HttpStudioGraphql } from './studio-graphql.ts';
import type { McpTarget } from './tool-definition.ts';
import { ToolError } from './tool-error.ts';

/** Environment variable with the Studio GraphQL endpoint (the AppSync URL in AWS). */
export const STUDIO_GRAPHQL_URL_ENV = 'STUDIO_GRAPHQL_URL';

export interface ToolHandlerOptions {
  /** Studio GraphQL endpoint; read on each call so a missing value fails as a tool error. */
  readonly graphqlUrl: () => string;
  readonly fetch?: FetchFunction;
  readonly logger?: Logger;
  /** Every target of the MCP, for `get_my_access`; by default only this one. */
  readonly targets?: readonly McpTarget[];
}

/** Lambda handler of a gateway target. */
export type GatewayToolHandler = (event: unknown, context: GatewayLambdaContext) => Promise<unknown>;

/** The Studio GraphQL endpoint from the environment of the Lambda function. */
export function graphqlUrlFromEnv(): string {
  const url = process.env[STUDIO_GRAPHQL_URL_ENV];
  if (url === undefined || url === '') throw new Error(`${STUDIO_GRAPHQL_URL_ENV} is not set.`);
  return url;
}

/**
 * Builds the handler of one target. Every answer is JSON: the tool result, or `{ error: { code, message } }`.
 * Arguments, results and the token are never logged.
 */
export function createToolHandler(target: McpTarget, options: ToolHandlerOptions): GatewayToolHandler {
  const tools = new Map(target.tools.map((tool) => [tool.name, tool]));
  const logger = options.logger ?? new Logger({ service: 'studio-mcp', target: target.name });
  return async (event: unknown, context: GatewayLambdaContext): Promise<unknown> => {
    const started = Date.now();
    const invocation = readInvocation(event, context);
    let outcome = 'ok';
    try {
      const tool = tools.get(invocation.toolName);
      if (tool === undefined) throw new ToolError('unknown_tool', `La herramienta "${invocation.toolName}" no existe en ${target.name}.`);
      if (invocation.token === null) {
        throw ToolError.unauthenticated(`Falta el token de la persona: el Gateway debe mandar el encabezado ${STUDIO_TOKEN_HEADER}.`);
      }
      const studio = new HttpStudioGraphql(options.graphqlUrl(), invocation.token, options.fetch);
      return await tool.call(invocation.args, { studio, targets: options.targets ?? [target] });
    } catch (error) {
      if (!(error instanceof ToolError)) {
        logger.error('Studio tool failed', { tool: invocation.toolName, error: error instanceof Error ? error.message : 'unknown error' });
      }
      const failure = error instanceof ToolError ? error : ToolError.unavailable();
      outcome = failure.code;
      return failure.toFailure();
    } finally {
      logger.info('Studio tool call', { tool: invocation.toolName, outcome, durationMs: Date.now() - started });
    }
  };
}
