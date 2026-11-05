import type { ClaimsBuilder, StudioClaims } from '@lumia/api/auth';
import { DEV_JWT_TTL_S } from './dev-jwt.ts';
import type { DevJwtIssuer } from './dev-jwt-issuer.ts';

export interface DevLoginResult {
  token: string;
  /** Lifetime of the token in seconds. */
  expiresIn: number;
  claims: StudioClaims;
}

/**
 * Development login of the sandbox: it signs the token of any active person by email, without a password.
 * It exists only in the local server; in AWS people sign in with Cognito.
 */
export class DevAuth {
  public constructor(
    private readonly claimsBuilder: ClaimsBuilder,
    private readonly issuer: DevJwtIssuer,
  ) {}

  /** @throws UnauthorizedError when no active person has the email or the person has no role. */
  public async login(email: string): Promise<DevLoginResult> {
    const normalized = email.trim().toLowerCase();
    const claims = await this.claimsBuilder.build(normalized, `dev:${normalized}`);
    // The check above answers 401 or 403 now; the token itself only says who the person is.
    return { token: await this.issuer.issue({ sub: claims.sub, email: claims.email, name: claims.name }), expiresIn: DEV_JWT_TTL_S, claims };
  }
}
