import { jwtVerify } from 'jose';
import type { Caller, IdentityResolver } from './caller.ts';
import { UnauthenticatedError } from './caller.ts';

/** Issuer of the development tokens of the sandbox (`sandbox/src/auth`). */
export const DEV_TOKEN_ISSUER = 'lumia-studio-sandbox';

/** Shortest secret accepted, as the sandbox requires; a shorter HS256 secret is easy to guess. */
const MIN_SECRET_LENGTH = 16;

/**
 * Verifies the HS256 development tokens that the sandbox login issues, in place of Cognito.
 * Only the local entry point uses it.
 */
export class DevTokenVerifier implements IdentityResolver {
  private readonly key: Uint8Array;

  public constructor(secret: string) {
    if (secret.length < MIN_SECRET_LENGTH) {
      throw new RangeError(`The development token secret must have at least ${String(MIN_SECRET_LENGTH)} characters.`);
    }
    this.key = new TextEncoder().encode(secret);
  }

  public async resolve(token: string): Promise<Caller> {
    let sub: unknown;
    try {
      const { payload } = await jwtVerify(token, this.key, { issuer: DEV_TOKEN_ISSUER, algorithms: ['HS256'] });
      sub = payload.sub;
    } catch (error) {
      throw new UnauthenticatedError('The development token is not valid or expired.', { cause: error });
    }
    if (typeof sub !== 'string' || sub === '') {
      throw new UnauthenticatedError('The development token has no subject.');
    }
    return { sub, token };
  }
}
