import { t } from '../i18n/index.ts';
import type { AuthProvider, AuthUser } from './auth-provider.ts';
import { AuthError } from './auth-provider.ts';

const STORAGE_KEY = 'lumia.studio.session';

interface StoredSession {
  token: string;
  user: AuthUser;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** Maps the Studio claims returned by `POST /dev/login`. */
export function userFromClaims(claims: unknown): AuthUser | null {
  if (!isRecord(claims)) return null;
  const { sub, email, name, studio_role: role, studio_role_name: roleName } = claims;
  if (typeof sub !== 'string' || typeof email !== 'string') return null;
  return {
    sub,
    email,
    name: typeof name === 'string' && name.trim() !== '' ? name : email,
    role: typeof role === 'string' ? role : '',
    roleName: typeof roleName === 'string' && roleName !== '' ? roleName : typeof role === 'string' ? role : '',
    actions: stringList(claims.studio_actions),
  };
}

/**
 * Development login of the sandbox (`POST /dev/login`): any active account signs in with its email; the password is
 * not checked. The token lives in `sessionStorage`.
 */
export class DevAuthProvider implements AuthProvider {
  private session: StoredSession | null;

  public constructor(
    private readonly loginUrl: string,
    private readonly storage: Storage = sessionStorage,
    private readonly fetcher: typeof fetch = fetch.bind(globalThis),
  ) {
    this.session = this.read();
  }

  public restore(): Promise<AuthUser | null> {
    return Promise.resolve(this.session?.user ?? null);
  }

  public async signIn(email: string): Promise<AuthUser> {
    let response: Response;
    try {
      response = await this.fetcher(this.loginUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      throw new AuthError(t('auth.errors.network'), 'network');
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = isRecord(body) && typeof body.message === 'string' ? body.message : t('auth.errors.signInFailed');
      throw new AuthError(message, response.status === 403 ? 'no_access' : 'credentials');
    }
    const token = isRecord(body) ? body.token : undefined;
    const user = isRecord(body) ? userFromClaims(body.claims) : null;
    if (typeof token !== 'string' || user === null) throw new AuthError(t('auth.errors.invalidResponse'));
    this.session = { token, user };
    this.storage.setItem(STORAGE_KEY, JSON.stringify(this.session));
    return user;
  }

  public signOut(): Promise<void> {
    this.session = null;
    this.storage.removeItem(STORAGE_KEY);
    return Promise.resolve();
  }

  /** The sandbox has no temporary passwords. */
  public confirmNewPassword(): Promise<AuthUser> {
    return Promise.reject(new AuthError(t('auth.errors.noTemporaryPasswords')));
  }

  public getToken(): Promise<string | null> {
    return Promise.resolve(this.session?.token ?? null);
  }

  private read(): StoredSession | null {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed) || typeof parsed.token !== 'string' || !isRecord(parsed.user)) return null;
      const stored = parsed.user;
      const user = userFromClaims({
        sub: stored.sub,
        email: stored.email,
        name: stored.name,
        studio_role: stored.role,
        studio_role_name: stored.roleName,
        studio_actions: stored.actions,
      });
      return user === null ? null : { token: parsed.token, user };
    } catch {
      // A corrupted stored session means the person has to sign in again.
      return null;
    }
  }
}
