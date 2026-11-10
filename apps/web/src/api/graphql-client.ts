import { t } from '../i18n/index.ts';

/** Error returned by the API, with the AppSync `errorType` and its message (the API writes it in Spanish). */
export class ApiError extends Error {
  public constructor(
    public readonly errorType: string,
    message: string,
    /** Messages by field path (`props.text`, `geometry`) when the API names the fields. */
    public readonly fields: Readonly<Record<string, string>> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  public get isUnauthorized(): boolean {
    return this.errorType === 'Unauthorized' || this.errorType === 'UnauthorizedException';
  }
}

const FIELD_PATTERN = /(props(?:\.[A-Za-z0-9_]+)*|geometry|component|appearsAtS|mediaId|type|background|slideIds):\s/g;

/** Extracts `path: message` pairs from a validation message such as `Elemento (title): props.text: Texto demasiado corto.` */
export function parseFieldErrors(message: string): Record<string, string> {
  const matches = [...message.matchAll(FIELD_PATTERN)];
  const fields: Record<string, string> = {};
  matches.forEach((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? message.length;
    const path = match[1];
    if (path !== undefined) fields[path] = message.slice(start, end).trim();
  });
  return fields;
}

export interface TokenSource {
  getToken(): Promise<string | null>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** GraphQL over `fetch` with a bearer token; the same client serves the sandbox and AppSync. */
export class GraphqlClient {
  public constructor(
    private readonly url: string,
    private readonly tokens: TokenSource,
    private readonly onUnauthorized: () => void = () => undefined,
    private readonly fetcher: typeof fetch = fetch.bind(globalThis),
  ) {}

  public async request(query: string, variables: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const token = await this.tokens.getToken();
    let response: Response;
    try {
      response = await this.fetcher(this.url, {
        method: 'POST',
        // AppSync takes the bare Cognito token; the sandbox takes it with or without `Bearer`.
        headers: { 'content-type': 'application/json', ...(token === null ? {} : { authorization: token }) },
        body: JSON.stringify({ query, variables }),
      });
    } catch {
      throw new ApiError('NetworkError', t('errors.network'));
    }
    const body: unknown = await response.json().catch(() => null);
    if (response.status === 401 || response.status === 403) {
      this.onUnauthorized();
      throw new ApiError('Unauthorized', t('errors.sessionEnded'));
    }
    if (!isRecord(body)) throw new ApiError('InternalError', t('errors.invalidResponse'));
    const errors: unknown = body.errors;
    const first: unknown = Array.isArray(errors) ? errors[0] : undefined;
    if (isRecord(first)) {
      const errorType = typeof first.errorType === 'string' ? first.errorType : 'InternalError';
      const message = typeof first.message === 'string' ? first.message : t('errors.generic');
      const error = new ApiError(errorType, message, parseFieldErrors(message));
      if (error.isUnauthorized) this.onUnauthorized();
      throw error;
    }
    if (!isRecord(body.data)) throw new ApiError('InternalError', t('errors.noData'));
    return body.data;
  }
}
