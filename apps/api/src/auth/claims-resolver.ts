import { AppError } from '../shared/errors/index.ts';
import type { StudioClaims } from './claims.ts';
import type { TokenIdentity } from './token-identity.ts';
import { UnauthorizedError } from './unauthorized-error.ts';

/** Builds the claims of one person from the database; `ClaimsBuilder` in production. */
export interface ClaimsSource {
  build(email: string, sub: string): Promise<StudioClaims>;
}

/** Changes of role or access apply within this time, without signing in again. */
export const CLAIMS_TTL_MS = 60_000;
const MAX_CACHED = 500;
const NO_EMAIL = 'La sesión no identifica a la persona. Vuelve a iniciar sesión.';

/**
 * Claims of the caller for each request: the token only identifies the person, and Studio reads their role,
 * actions and granted categories from the database. A short cache per process spares a query per field.
 */
export class ClaimsResolver {
  private readonly cache = new Map<string, { claims: StudioClaims; expiresAt: number }>();

  public constructor(
    private readonly source: ClaimsSource,
    private readonly ttlMs: number = CLAIMS_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  /** @throws AppError('Unauthorized') when the person is unknown, disabled or has no role. */
  public async resolve(identity: TokenIdentity): Promise<StudioClaims> {
    if (identity.email === null) {
      throw AppError.unauthorized(NO_EMAIL);
    }
    const key = `${identity.sub}\n${identity.email.toLowerCase()}`;
    const cached = this.cache.get(key);
    if (cached !== undefined && cached.expiresAt > this.now()) {
      return cached.claims;
    }
    let claims: StudioClaims;
    try {
      claims = await this.source.build(identity.email, identity.sub);
    } catch (error) {
      this.cache.delete(key);
      if (error instanceof UnauthorizedError) {
        throw AppError.unauthorized(error.message);
      }
      throw error;
    }
    if (this.cache.size >= MAX_CACHED) {
      this.cache.clear();
    }
    this.cache.set(key, { claims, expiresAt: this.now() + this.ttlMs });
    return claims;
  }
}
