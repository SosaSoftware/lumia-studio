/** Who the token says the caller is. Studio reads the role, actions and access of that person from its database. */
export interface TokenIdentity {
  readonly sub: string;
  /** Email, when the token carries it (the sandbox token does); Cognito access tokens do not. */
  readonly email: string | null;
}

/** Reads the identity from the claims of a verified token; null when there is no subject. */
export function tokenIdentity(raw: Readonly<Record<string, unknown>> | null | undefined): TokenIdentity | null {
  const sub = raw?.sub;
  if (typeof sub !== 'string' || sub === '') return null;
  const email = raw?.email;
  return { sub, email: typeof email === 'string' && email.trim() !== '' ? email.trim() : null };
}
