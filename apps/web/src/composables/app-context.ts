import { ref } from 'vue';
import { t } from '../i18n/index.ts';
import type { Ref } from 'vue';
import type { AuthProvider, AuthUser } from '../auth/auth-provider.ts';
import { CognitoAuthProvider } from '../auth/cognito-auth-provider.ts';
import { DevAuthProvider } from '../auth/dev-auth-provider.ts';
import { GraphqlClient } from '../api/graphql-client.ts';
import { StudioApi } from '../api/studio-api.ts';
import type { AppConfig } from '../config/app-config.ts';

/** Action keys the interface checks with `can`; the API enforces the same actions with Cedar. */
export const ACTIONS = {
  view: 'documents.view',
  edit: 'documents.edit',
  upload: 'media.upload',
  narration: 'narration.generate',
  publish: 'documents.publish',
} as const;

/** Wiring of the app: configuration, sign-in and the API clients. */
export class AppContext {
  public readonly auth: AuthProvider;
  public readonly studio: StudioApi;
  public readonly user: Ref<AuthUser | null>;

  public constructor(
    public readonly config: AppConfig,
    auth?: AuthProvider,
  ) {
    this.auth = auth ?? AppContext.authFor(config);
    this.user = ref(null);
    const unauthorized = (): void => {
      void this.signOut();
    };
    this.studio = new StudioApi(new GraphqlClient(config.apiUrl, this.auth, unauthorized));
  }

  /** The sign-in of the deployment: the sandbox login, or the Cognito user pool of Lumia Studio. */
  private static authFor(config: AppConfig): AuthProvider {
    if (config.authMode === 'dev' || config.cognito === undefined) return new DevAuthProvider('/dev/login');
    const settings = config.cognito;
    return new CognitoAuthProvider(async () => (await import('../auth/amplify-cognito-client.ts')).amplifyCognitoClient(settings));
  }

  /** Restores the session the browser kept and reads the access of the person; called once before the app mounts. */
  public async init(): Promise<void> {
    this.user.value = await this.auth.restore();
    await this.refreshAccess();
  }

  /** Finishes a first sign-in with the new password; like `signIn`, then reads the access from Studio. */
  public async confirmNewPassword(password: string): Promise<AuthUser> {
    const user = await this.auth.confirmNewPassword(password);
    this.user.value = user;
    await this.refreshAccess();
    return this.signedIn() ?? user;
  }

  public async signIn(email: string, password: string): Promise<AuthUser> {
    const user = await this.auth.signIn(email, password);
    this.user.value = user;
    await this.refreshAccess();
    return this.signedIn() ?? user;
  }

  /**
   * Reads the person's role and actions from Studio. The token only identifies the person, so a change of role or
   * access shows here without signing in again. When the API cannot answer, the last known access stays.
   */
  public async refreshAccess(): Promise<void> {
    if (this.signedIn() === null) return;
    try {
      const access = await this.studio.me();
      // The person may have signed out while the answer was on its way.
      const current = this.signedIn();
      if (current !== null) this.user.value = { ...current, ...access };
    } catch {
      // The interface keeps the access it knew; the API still checks every action.
    }
  }

  public async signOut(): Promise<void> {
    await this.auth.signOut();
    this.user.value = null;
  }

  private signedIn(): AuthUser | null {
    return this.user.value;
  }

  /** Whether the signed-in person has the action; the backend still enforces it. */
  public can(action: string): boolean {
    return this.user.value?.actions.includes(action) ?? false;
  }
}

let current: AppContext | null = null;

export function setApp(app: AppContext): void {
  current = app;
}

export function useApp(): AppContext {
  if (current === null) throw new Error(t('errors.appNotInitialized'));
  return current;
}

/** Shorthand for `useApp().can`. */
export function can(action: string): boolean {
  return useApp().can(action);
}
