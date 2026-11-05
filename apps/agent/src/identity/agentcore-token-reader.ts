import { decodeJwt } from 'jose';
import type { Caller, IdentityResolver } from './caller.ts';
import { UnauthenticatedError } from './caller.ts';

/** Seconds of clock difference tolerated when checking the expiry again. */
const CLOCK_SKEW_S = 60;

/**
 * Reads the Cognito token of a request that reached Lumi through AgentCore Runtime.
 *
 * The runtime's inbound JWT authorizer has already verified the signature, issuer, client and expiry, and it
 * rejects every request without a valid token, so the token is decoded without verifying it again. The subject
 * and the expiry are still checked, so a misconfigured runtime fails closed.
 */
export class AgentCoreTokenReader implements IdentityResolver {
  public constructor(private readonly nowSeconds: () => number = () => Math.floor(Date.now() / 1000)) {}

  public resolve(token: string): Promise<Caller> {
    let claims: ReturnType<typeof decodeJwt>;
    try {
      claims = decodeJwt(token);
    } catch (error) {
      return Promise.reject(new UnauthenticatedError('The token is not a JWT.', { cause: error }));
    }
    if (typeof claims.sub !== 'string' || claims.sub === '') {
      return Promise.reject(new UnauthenticatedError('The token has no subject.'));
    }
    if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_S < this.nowSeconds()) {
      return Promise.reject(new UnauthenticatedError('The token expired.'));
    }
    return Promise.resolve({ sub: claims.sub, token });
  }
}
