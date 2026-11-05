import { SignJWT } from 'jose';
import type { Config } from '@lumia/api/config';
import { DEV_JWT_ISSUER, DEV_JWT_TTL_S, encodeSecret } from './dev-jwt.ts';

/** Who a development token identifies; like Cognito, it carries no role or access. */
export interface DevIdentity {
  sub: string;
  email: string;
  name: string;
}

/** Issues HS256 development tokens with the identity of the person (sandbox replacement of Cognito). */
export class DevJwtIssuer {
  private readonly key: Uint8Array;

  public constructor(secret: string) {
    this.key = encodeSecret(secret);
  }

  public static fromConfig(config: Config): DevJwtIssuer {
    return new DevJwtIssuer(config.required('LUMIA_DEV_JWT_SECRET'));
  }

  public async issue(identity: DevIdentity): Promise<string> {
    return new SignJWT({ email: identity.email, name: identity.name })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(DEV_JWT_ISSUER)
      .setSubject(identity.sub)
      .setIssuedAt()
      .setExpirationTime(`${String(DEV_JWT_TTL_S)}s`)
      .sign(this.key);
  }
}
