import { t } from '../i18n/index.ts';
import type { AuthProvider, AuthUser } from './auth-provider.ts';
import { AuthError } from './auth-provider.ts';

/** The answer of a sign-in step: done, or the next step Cognito asks for. */
export interface CognitoStep {
  readonly done: boolean;
  /** Amplify's `nextStep.signInStep`, e.g. `CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED`. */
  readonly step: string;
}

/** The claims of the access token the provider reads. */
export interface CognitoTokens {
  readonly accessToken: string;
  readonly claims: Readonly<Record<string, unknown>>;
}

/** The Cognito operations the provider needs; `amplifyCognitoClient` implements them with Amplify Auth. */
export interface CognitoClient {
  signIn(email: string, password: string): Promise<CognitoStep>;
  confirmNewPassword(password: string): Promise<CognitoStep>;
  signOut(): Promise<void>;
  /** The current tokens, refreshed when they expired; null without a session. */
  tokens(): Promise<CognitoTokens | null>;
}

export const NEW_PASSWORD_STEP = 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED';
const ALREADY_SIGNED_IN = 'UserAlreadyAuthenticatedException';

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : '';
}

/** Cognito errors in the words of the sign-in page; the account data is never confirmed or denied separately. */
function toAuthError(error: unknown): AuthError {
  switch (errorName(error)) {
    case 'NotAuthorizedException':
    case 'UserNotFoundException':
      return new AuthError(t('auth.errors.badCredentials'));
    case 'InvalidPasswordException':
      return new AuthError(t('auth.errors.invalidNewPassword'));
    case 'PasswordResetRequiredException':
      return new AuthError(t('auth.errors.passwordReset'));
    case 'LimitExceededException':
    case 'TooManyRequestsException':
      return new AuthError(t('auth.errors.tooManyAttempts'));
    case 'NetworkError':
      return new AuthError(t('auth.errors.network'), 'network');
    default:
      return error instanceof TypeError ? new AuthError(t('auth.errors.network'), 'network') : new AuthError(t('auth.errors.signInFailed'));
  }
}

/** The person the access token identifies; name, role and actions come from Studio afterwards (`me`). */
function userFrom(tokens: CognitoTokens): AuthUser {
  const sub = typeof tokens.claims.sub === 'string' ? tokens.claims.sub : '';
  const email = typeof tokens.claims.email === 'string' ? tokens.claims.email : typeof tokens.claims.username === 'string' ? tokens.claims.username : '';
  return { sub, email, name: email, role: '', roleName: '', actions: [] };
}

/** Sign-in with the Cognito user pool of Lumia Studio, with the design of the sign-in page (SRP, no hosted pages). */
export class CognitoAuthProvider implements AuthProvider {
  private loaded: Promise<CognitoClient> | null = null;

  /** @param load Returns the client; Amplify is loaded on first use, so the sandbox never downloads it. */
  public constructor(private readonly load: () => Promise<CognitoClient>) {}

  private get client(): Promise<CognitoClient> {
    this.loaded ??= this.load();
    return this.loaded;
  }

  public async restore(): Promise<AuthUser | null> {
    try {
      const tokens = await (await this.client).tokens();
      return tokens === null ? null : userFrom(tokens);
    } catch {
      // An expired or broken session means the person signs in again.
      return null;
    }
  }

  public async signIn(email: string, password: string): Promise<AuthUser> {
    const client = await this.client;
    let step: CognitoStep;
    try {
      step = await client.signIn(email.trim(), password);
    } catch (error) {
      if (errorName(error) !== ALREADY_SIGNED_IN) throw toAuthError(error);
      // A session of another person may still be kept by the browser.
      await client.signOut();
      step = await client.signIn(email.trim(), password).catch((retry: unknown) => {
        throw toAuthError(retry);
      });
    }
    return this.finish(client, step);
  }

  public async confirmNewPassword(password: string): Promise<AuthUser> {
    const client = await this.client;
    let step: CognitoStep;
    try {
      step = await client.confirmNewPassword(password);
    } catch (error) {
      throw toAuthError(error);
    }
    return this.finish(client, step);
  }

  public async signOut(): Promise<void> {
    await (await this.client).signOut();
  }

  public async getToken(): Promise<string | null> {
    try {
      return (await (await this.client).tokens())?.accessToken ?? null;
    } catch {
      return null;
    }
  }

  private async finish(client: CognitoClient, step: CognitoStep): Promise<AuthUser> {
    if (step.step === NEW_PASSWORD_STEP) {
      throw new AuthError(t('auth.errors.newPasswordRequired'), 'new_password');
    }
    if (!step.done) {
      throw new AuthError(t('auth.errors.unsupportedStep'));
    }
    const tokens = await client.tokens();
    if (tokens === null) throw new AuthError(t('auth.errors.signInFailed'));
    return userFrom(tokens);
  }
}
