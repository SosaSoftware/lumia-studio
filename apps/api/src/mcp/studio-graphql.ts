import { list, record, text } from './decode.ts';
import { ToolError } from './tool-error.ts';

/** AppSync answers within 30 s; a database that wakes up from a pause takes about 15 s of that. */
const REQUEST_TIMEOUT_MS = 28_000;

/** GraphQL access to the Studio API as one person. */
export interface StudioGraphql {
  request(query: string, variables?: Readonly<Record<string, unknown>>): Promise<Record<string, unknown>>;
}

export type FetchFunction = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Calls the Studio GraphQL endpoint (AppSync in AWS, the sandbox locally) with the person's own token,
 * so Studio applies that person's permissions to every read and write.
 */
export class HttpStudioGraphql implements StudioGraphql {
  public constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly fetchFn: FetchFunction = fetch,
    private readonly timeoutMs: number = REQUEST_TIMEOUT_MS,
  ) {}

  public async request(query: string, variables: Readonly<Record<string, unknown>> = {}): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await this.fetchFn(this.url, {
        method: 'POST',
        // AppSync takes the bare Cognito token in Authorization.
        headers: { 'content-type': 'application/json', authorization: this.token },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw ToolError.unavailable();
    }
    if (response.status === 401) {
      throw ToolError.unauthenticated();
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw ToolError.unavailable();
    }
    const answer = record(body);
    const [first] = list(answer.errors);
    if (first !== undefined) {
      throw HttpStudioGraphql.toToolError(record(first));
    }
    if (!response.ok) {
      throw ToolError.unavailable();
    }
    return record(answer.data);
  }

  /** Studio errors carry an `errorType`; AppSync uses `UnauthorizedException` for a missing or expired token. */
  private static toToolError(error: Record<string, unknown>): ToolError {
    const message = text(error.message, 'Studio rechazó la acción.');
    switch (text(error.errorType)) {
      case 'Unauthorized':
        return ToolError.forbidden(message);
      case 'UnauthorizedException':
        return ToolError.unauthenticated();
      case 'NotFound':
        return ToolError.notFound(message);
      case 'ValidationError':
        return ToolError.invalidInput(message);
      case 'Conflict':
        return ToolError.conflict(message);
      default:
        return ToolError.unavailable(message);
    }
  }
}
