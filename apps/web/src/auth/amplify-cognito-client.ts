import { Amplify } from 'aws-amplify';
import { confirmSignIn, fetchAuthSession, signIn, signOut } from 'aws-amplify/auth';
import type { CognitoClient, CognitoStep, CognitoTokens } from './cognito-auth-provider.ts';

export interface CognitoSettings {
  readonly userPoolId: string;
  readonly userPoolClientId: string;
}

/** Cognito through Amplify Auth: SRP sign-in, the first-password step and tokens refreshed with the refresh token. */
export function amplifyCognitoClient(settings: CognitoSettings): CognitoClient {
  Amplify.configure({ Auth: { Cognito: { userPoolId: settings.userPoolId, userPoolClientId: settings.userPoolClientId, loginWith: { email: true } } } });
  const step = (answer: { isSignedIn: boolean; nextStep: { signInStep: string } }): CognitoStep => ({ done: answer.isSignedIn, step: answer.nextStep.signInStep });
  return {
    signIn: async (email, password) => step(await signIn({ username: email, password, options: { authFlowType: 'USER_SRP_AUTH' } })),
    confirmNewPassword: async (password) => step(await confirmSignIn({ challengeResponse: password })),
    signOut: () => signOut(),
    tokens: async (): Promise<CognitoTokens | null> => {
      const access = (await fetchAuthSession()).tokens?.accessToken;
      return access === undefined ? null : { accessToken: access.toString(), claims: { ...access.payload } };
    },
  };
}
