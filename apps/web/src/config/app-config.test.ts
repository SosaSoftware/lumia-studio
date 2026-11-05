import { describe, expect, it } from 'vitest';
import { parseConfig } from './app-config.ts';

describe('config.json', () => {
  it('reads the sandbox and the Cognito settings', () => {
    expect(parseConfig({ apiUrl: '/graphql', authMode: 'dev', lumiUrl: null })).toEqual({ apiUrl: '/graphql', authMode: 'dev', lumiUrl: null });
    const aws = { apiUrl: 'https://api.test/graphql', authMode: 'cognito', lumiUrl: 'https://lumi.test/invocations', cognito: { userPoolId: 'us-east-1_abc', userPoolClientId: 'client' } };
    expect(parseConfig(aws)).toEqual(aws);
  });

  it('needs the user pool and the client with Cognito', () => {
    expect(() => parseConfig({ apiUrl: '/graphql', authMode: 'cognito', cognito: { userPoolId: 'us-east-1_abc' } })).toThrow(/userPoolClientId/);
  });
});
