import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { DEV_JWT_ISSUER } from './dev-jwt.ts';
import { DevJwtIssuer } from './dev-jwt-issuer.ts';
import { DevJwtVerifier } from './dev-jwt-verifier.ts';

const SECRET = 'a-test-secret-with-enough-length';
const identity = { sub: 'dev:ana@lumia.studio', email: 'ana@lumia.studio', name: 'Ana' };

describe('development JWT', () => {
  it('issues and verifies a token that only identifies the person, like Cognito', async () => {
    const token = await new DevJwtIssuer(SECRET).issue(identity);
    await expect(new DevJwtVerifier(SECRET).verify(token)).resolves.toEqual({ sub: identity.sub, email: identity.email });
    const payload: unknown = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString());
    expect(payload).not.toHaveProperty('studio_actions');
  });

  it('rejects a tampered token and a token signed with another secret', async () => {
    const token = await new DevJwtIssuer(SECRET).issue(identity);
    const [header = '', , signature = ''] = token.split('.');
    const body = Buffer.from(JSON.stringify({ ...identity, email: 'otra@lumia.studio' })).toString('base64url');
    await expect(new DevJwtVerifier(SECRET).verify(`${header}.${body}.${signature}`)).rejects.toMatchObject({ errorType: 'Unauthorized' });
    const other = await new DevJwtIssuer('another-secret-with-enough-length').issue(identity);
    await expect(new DevJwtVerifier(SECRET).verify(other)).rejects.toMatchObject({ errorType: 'Unauthorized' });
  });

  it('rejects an expired token, a wrong issuer and a token without email', async () => {
    const key = new TextEncoder().encode(SECRET);
    const now = Math.floor(Date.now() / 1000);
    const expired = await new SignJWT({ ...identity }).setProtectedHeader({ alg: 'HS256' }).setIssuer(DEV_JWT_ISSUER).setIssuedAt(now - 100).setExpirationTime(now - 10).sign(key);
    const wrongIssuer = await new SignJWT({ ...identity }).setProtectedHeader({ alg: 'HS256' }).setIssuer('x').setExpirationTime('1h').sign(key);
    const partial = await new SignJWT({ sub: 'u1' }).setProtectedHeader({ alg: 'HS256' }).setIssuer(DEV_JWT_ISSUER).setExpirationTime('1h').sign(key);
    const verifier = new DevJwtVerifier(SECRET);
    for (const token of [expired, wrongIssuer, partial]) {
      await expect(verifier.verify(token)).rejects.toMatchObject({ errorType: 'Unauthorized' });
    }
  });

  it('rejects short secrets', () => {
    expect(() => new DevJwtIssuer('short')).toThrow();
  });
});
