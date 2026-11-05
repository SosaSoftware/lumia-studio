import { describe, expect, it } from 'vitest';
import { SignJWT, UnsecuredJWT } from 'jose';
import { AgentCoreTokenReader } from './agentcore-token-reader.ts';
import { UnauthenticatedError } from './caller.ts';
import { DEV_TOKEN_ISSUER, DevTokenVerifier } from './dev-token-verifier.ts';

const SECRET = 'a-development-secret-value';

function devToken(claims: { sub?: string; issuer?: string; secret?: string; expiresIn?: string }): Promise<string> {
  const jwt = new SignJWT({ email: 'creadora@studio.test' }).setProtectedHeader({ alg: 'HS256' }).setIssuer(claims.issuer ?? DEV_TOKEN_ISSUER).setIssuedAt().setExpirationTime(claims.expiresIn ?? '1h');
  if (claims.sub !== undefined) jwt.setSubject(claims.sub);
  return jwt.sign(new TextEncoder().encode(claims.secret ?? SECRET));
}

describe('DevTokenVerifier', () => {
  const verifier = new DevTokenVerifier(SECRET);

  it('resolves the subject of a sandbox token', async () => {
    const token = await devToken({ sub: 'dev:creadora@studio.test' });
    await expect(verifier.resolve(token)).resolves.toEqual({ sub: 'dev:creadora@studio.test', token });
  });

  it('rejects tokens with another secret, another issuer, no subject or past their expiry', async () => {
    for (const token of [
      await devToken({ sub: 's', secret: 'another-secret-of-16-chars' }),
      await devToken({ sub: 's', issuer: 'someone-else' }),
      await devToken({}),
      await devToken({ sub: 's', expiresIn: '-1m' }),
      'not-a-jwt',
    ]) {
      await expect(verifier.resolve(token)).rejects.toBeInstanceOf(UnauthenticatedError);
    }
  });

  it('refuses a short secret', () => {
    expect(() => new DevTokenVerifier('short')).toThrow(RangeError);
  });
});

describe('AgentCoreTokenReader', () => {
  const now = 1_800_000_000;
  const reader = new AgentCoreTokenReader(() => now);

  function cognitoToken(claims: Record<string, unknown>): string {
    return new UnsecuredJWT(claims).encode();
  }

  it('reads the subject of a token that AgentCore already validated', async () => {
    const token = cognitoToken({ sub: '4f1c2d3e-uuid', exp: now + 600, token_use: 'access' });
    await expect(reader.resolve(token)).resolves.toEqual({ sub: '4f1c2d3e-uuid', token });
  });

  it('fails closed on tokens without a subject, expired or malformed', async () => {
    for (const token of [cognitoToken({ exp: now + 600 }), cognitoToken({ sub: 's', exp: now - 3600 }), cognitoToken({ sub: 's' }), 'garbage']) {
      await expect(reader.resolve(token)).rejects.toBeInstanceOf(UnauthenticatedError);
    }
  });
});
