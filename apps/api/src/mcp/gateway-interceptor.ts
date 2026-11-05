import { STUDIO_TOKEN_HEADER } from './gateway-invocation.ts';

/**
 * Request interceptor of the Studio MCP gateway. It copies the person's token from the validated `Authorization`
 * header into the propagated header the tool Lambdas read, so Studio applies that person's permissions. The gateway
 * already verified the token with its Cognito authorizer before this runs, and the model never sees the token.
 */

/** The part of the interceptor input the gateway fills; headers come only with `passRequestHeaders`. */
interface InterceptorInput {
  mcp?: { gatewayRequest?: { headers?: Readonly<Record<string, string>>; body?: unknown } };
}

/** What the interceptor returns; adding the header to the propagated set, without touching the request body. */
interface InterceptorOutput {
  interceptorOutputVersion: '1.0';
  mcp: { transformedGatewayRequest: { headers: Record<string, string>; body?: unknown } };
}

function headerValue(headers: Readonly<Record<string, string>>, name: string): string | undefined {
  const wanted = name.toLowerCase();
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === wanted);
  return entry?.[1];
}

/** Lambda handler of the interceptor; attached to the Studio MCP gateway for REQUEST interception. */
export function handler(event: unknown): Promise<InterceptorOutput> {
  const input = (typeof event === 'object' && event !== null ? event : {}) as InterceptorInput;
  const request = input.mcp?.gatewayRequest ?? {};
  const headers = request.headers ?? {};
  const authorization = headerValue(headers, 'authorization');
  const token = authorization === undefined ? '' : authorization.replace(/^Bearer\s+/i, '').trim();
  // The header is on the target's allowlist, so the gateway propagates it to the tool Lambda.
  const transformed: Record<string, string> = token === '' ? {} : { [STUDIO_TOKEN_HEADER]: token };
  return Promise.resolve({ interceptorOutputVersion: '1.0', mcp: { transformedGatewayRequest: { headers: transformed, body: request.body } } });
}
