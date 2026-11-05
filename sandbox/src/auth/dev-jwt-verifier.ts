import { jwtVerify } from 'jose';
import { tokenIdentity } from '@lumia/api/auth';
import type { TokenIdentity } from '@lumia/api/auth';
import type { Config } from '@lumia/api/config';
import { AppError } from '@lumia/api/errors';
import { DEV_JWT_ISSUER, encodeSecret } from './dev-jwt.ts';

const INVALID_TOKEN = 'La sesión no es válida o expiró.';

/** Verifies a bearer token. Locally a development JWT; in AWS, AppSync verifies the Cognito token itself. */
export interface TokenVerifier {
  /** Throws `AppError('Unauthorized')` when the token is invalid or expired. */
  verify(token: string): Promise<TokenIdentity>;
}

/** Verifies HS256 development tokens. */
export class DevJwtVerifier implements TokenVerifier {
  private readonly key: Uint8Array;

  public constructor(secret: string) {
    this.key = encodeSecret(secret);
  }

  public static fromConfig(config: Config): DevJwtVerifier {
    return new DevJwtVerifier(config.required('LUMIA_DEV_JWT_SECRET'));
  }

  public async verify(token: string): Promise<TokenIdentity> {
    let payload: Record<string, unknown>;
    try {
      const result = await jwtVerify(token, this.key, { issuer: DEV_JWT_ISSUER, algorithms: ['HS256'] });
      payload = { ...result.payload };
    } catch (error) {
      throw new AppError('Unauthorized', INVALID_TOKEN, { cause: error });
    }
    const identity = tokenIdentity(payload);
    if (identity === null) {
      throw AppError.unauthorized(INVALID_TOKEN);
    }
    if (identity.email === null) {
      throw AppError.unauthorized(INVALID_TOKEN);
    }
    return identity;
  }
}
