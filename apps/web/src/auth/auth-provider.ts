/** The signed-in person as the interface shows them. The token identifies them; Studio says their role and actions (`me`). */
export interface AuthUser {
  sub: string;
  email: string;
  name: string;
  role: string;
  /** Display name of the role. */
  roleName: string;
  actions: string[];
}

/**
 * Why a sign-in did not finish: wrong account data, an account without access to Studio, the connection, or a first
 * sign-in that has to replace the temporary password (`confirmNewPassword` finishes it).
 */
export type AuthFailure = 'credentials' | 'no_access' | 'network' | 'new_password';

export class AuthError extends Error {
  public constructor(
    message: string,
    public readonly reason: AuthFailure = 'credentials',
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Sign-in adapter: the sandbox uses the development login; AWS uses the Cognito user pool of Lumia Studio. */
export interface AuthProvider {
  /** The session the browser kept, if it is still valid; called once before the app starts. */
  restore(): Promise<AuthUser | null>;
  /** @throws AuthError; with reason `new_password` the person must choose a password with `confirmNewPassword`. */
  signIn(email: string, password: string): Promise<AuthUser>;
  /** Finishes a first sign-in by replacing the temporary password. */
  confirmNewPassword(password: string): Promise<AuthUser>;
  signOut(): Promise<void>;
  /** A valid token for the Studio API and Lumi, refreshed when needed; null without a session. */
  getToken(): Promise<string | null>;
}
