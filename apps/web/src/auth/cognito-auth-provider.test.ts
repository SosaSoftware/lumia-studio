import { describe, expect, it } from 'vitest';
import type { CognitoClient, CognitoStep, CognitoTokens } from './cognito-auth-provider.ts';
import { CognitoAuthProvider, NEW_PASSWORD_STEP } from './cognito-auth-provider.ts';

function failure(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

const TOKENS: CognitoTokens = { accessToken: 'access.jwt', claims: { sub: 'abc-123', email: 'carlos@studio.test', client_id: 'web' } };
const DONE: CognitoStep = { done: true, step: 'DONE' };

/** A client whose sign-in steps are scripted; an Error in the script is thrown. */
function client(steps: (CognitoStep | Error)[], tokens: CognitoTokens | null = TOKENS): CognitoClient & { signOuts: number; passwords: string[] } {
  const next = (): Promise<CognitoStep> => {
    const answer = steps.shift() ?? DONE;
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  };
  const fake = {
    signOuts: 0,
    passwords: [] as string[],
    signIn: (): Promise<CognitoStep> => next(),
    confirmNewPassword: (password: string): Promise<CognitoStep> => {
      fake.passwords.push(password);
      return next();
    },
    signOut: (): Promise<void> => {
      fake.signOuts += 1;
      return Promise.resolve();
    },
    tokens: (): Promise<CognitoTokens | null> => Promise.resolve(tokens),
  };
  return fake;
}

describe('CognitoAuthProvider', () => {
  it('signs in and identifies the person by the access token; Studio adds the role later', async () => {
    const auth = new CognitoAuthProvider(() => Promise.resolve(client([DONE])));
    expect(await auth.signIn(' carlos@studio.test ', 'secreto')).toEqual({ sub: 'abc-123', email: 'carlos@studio.test', name: 'carlos@studio.test', role: '', roleName: '', actions: [] });
    expect(await auth.getToken()).toBe('access.jwt');
  });

  it('asks for a new password on a first sign-in and finishes with it', async () => {
    const fake = client([{ done: false, step: NEW_PASSWORD_STEP }, DONE]);
    const auth = new CognitoAuthProvider(() => Promise.resolve(fake));
    await expect(auth.signIn('carlos@studio.test', 'Temporal-123')).rejects.toMatchObject({ reason: 'new_password' });
    expect((await auth.confirmNewPassword('Nueva-Contraseña-123')).sub).toBe('abc-123');
    expect(fake.passwords).toEqual(['Nueva-Contraseña-123']);
  });

  it('says the same for a wrong password and an unknown account, and explains a weak new password', async () => {
    for (const name of ['NotAuthorizedException', 'UserNotFoundException']) {
      await expect(new CognitoAuthProvider(() => Promise.resolve(client([failure(name)]))).signIn('x@studio.test', 'y')).rejects.toMatchObject({ message: 'El correo o la contraseña no son correctos.', reason: 'credentials' });
    }
    await expect(new CognitoAuthProvider(() => Promise.resolve(client([failure('InvalidPasswordException')]))).confirmNewPassword('corta')).rejects.toMatchObject({ message: expect.stringMatching(/al menos 12 caracteres/) as string });
    await expect(new CognitoAuthProvider(() => Promise.resolve(client([failure('NetworkError')]))).signIn('x@studio.test', 'y')).rejects.toMatchObject({ reason: 'network' });
  });

  it('signs out a session the browser kept and tries again', async () => {
    const fake = client([failure('UserAlreadyAuthenticatedException'), DONE]);
    expect((await new CognitoAuthProvider(() => Promise.resolve(fake)).signIn('carlos@studio.test', 'secreto')).email).toBe('carlos@studio.test');
    expect(fake.signOuts).toBe(1);
  });

  it('restores a kept session and has no token without one', async () => {
    expect((await new CognitoAuthProvider(() => Promise.resolve(client([]))).restore())?.sub).toBe('abc-123');
    const empty = new CognitoAuthProvider(() => Promise.resolve(client([], null)));
    expect(await empty.restore()).toBeNull();
    expect(await empty.getToken()).toBeNull();
  });
});
