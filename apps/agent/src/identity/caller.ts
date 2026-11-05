/** The person behind a request, as their token identifies them. */
export interface Caller {
  /** Stable id of the person: the `sub` claim of their token. Conversations and preferences are kept per `sub`. */
  readonly sub: string;
  /** Bearer token of the person. It goes unchanged to the Studio MCP, so Studio applies that person's permissions. */
  readonly token: string;
}

/** Turns the bearer token of a request into the caller. */
export interface IdentityResolver {
  /**
   * @param token - The bearer token, without the `Bearer` prefix.
   * @throws UnauthenticatedError when the token is malformed, expired or not trusted.
   */
  resolve(token: string): Promise<Caller>;
}

/** Raised when a request does not carry a valid token of a person. */
export class UnauthenticatedError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'UnauthenticatedError';
  }
}
