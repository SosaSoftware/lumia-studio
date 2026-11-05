import { describe, expect, it } from 'vitest';
import type { StudioClaims } from './claims.ts';
import { ClaimsResolver } from './claims-resolver.ts';
import { tokenIdentity } from './token-identity.ts';
import { UnauthorizedError } from './unauthorized-error.ts';

const claims = (actions: string[]): StudioClaims => ({
  sub: 'dev:ana@studio.test',
  email: 'ana@studio.test',
  name: 'Ana',
  studio_user_id: 'u1',
  studio_role: 'content_creator',
  studio_role_name: 'Creación de contenido',
  studio_actions: actions,
  studio_categories: ['c1'],
  studio_subcategories: ['s1'],
});

describe('ClaimsResolver', () => {
  it('reads the claims from the source and keeps them for a minute', async () => {
    let clock = 0;
    let calls = 0;
    const source = {
      build: (): Promise<StudioClaims> => {
        calls += 1;
        return Promise.resolve(claims(calls === 1 ? ['documents.view'] : ['documents.view', 'documents.edit']));
      },
    };
    const resolver = new ClaimsResolver(source, 60_000, () => clock);
    const identity = { sub: 'dev:ana@studio.test', email: 'Ana@studio.test' };
    expect((await resolver.resolve(identity)).studio_actions).toEqual(['documents.view']);
    clock = 59_000;
    expect((await resolver.resolve(identity)).studio_actions).toEqual(['documents.view']);
    clock = 61_000;
    expect((await resolver.resolve(identity)).studio_actions).toEqual(['documents.view', 'documents.edit']);
    expect(calls).toBe(2);
  });

  it('turns an unknown person or a token without email into an Unauthorized error', async () => {
    const resolver = new ClaimsResolver({ build: () => Promise.reject(new UnauthorizedError('Tu cuenta no tiene acceso a Lumia Studio.', 'no_access')) });
    await expect(resolver.resolve({ sub: 's', email: 'x@studio.test' })).rejects.toMatchObject({ errorType: 'Unauthorized', message: 'Tu cuenta no tiene acceso a Lumia Studio.' });
    await expect(resolver.resolve({ sub: 's', email: null })).rejects.toMatchObject({ errorType: 'Unauthorized' });
  });

  it('reads the identity of a token: subject and email when there is one', () => {
    expect(tokenIdentity({ sub: 'abc', email: ' ana@studio.test ', studio_actions: ['x'] })).toEqual({ sub: 'abc', email: 'ana@studio.test' });
    expect(tokenIdentity({ sub: 'abc', client_id: 'web' })).toEqual({ sub: 'abc', email: null });
    expect(tokenIdentity({ email: 'ana@studio.test' })).toBeNull();
  });
});
