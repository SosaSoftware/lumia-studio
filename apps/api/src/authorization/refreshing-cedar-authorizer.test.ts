import { describe, expect, it } from 'vitest';
import { CEDAR_SCHEMA, makeClaims } from '../../test/support/claims.ts';
import { handler as preTokenGeneration } from '../lambda/pre-token-generation.ts';
import { PolicyGenerator } from './policy-generator.ts';
import { RefreshingCedarAuthorizer } from './refreshing-cedar-authorizer.ts';

function viewerPolicy(actions: string[]): Record<string, string> {
  return { viewer: PolicyGenerator.forRole('viewer', actions) ?? '' };
}

describe('RefreshingCedarAuthorizer', () => {
  it('uses the role policies for a minute and reloads them after that', async () => {
    let clock = 0;
    let loads = 0;
    let policies = viewerPolicy(['documents.view']);
    const authorizer = new RefreshingCedarAuthorizer(
      {
        load: () => {
          loads += 1;
          return Promise.resolve(policies);
        },
      },
      CEDAR_SCHEMA,
      60_000,
      () => clock,
    );
    const request = { claims: makeClaims({ studio_role: 'viewer' }), action: 'documents.edit' };
    expect((await authorizer.isAuthorized(request)).allowed).toBe(false);
    policies = viewerPolicy(['documents.view', 'documents.edit']);
    clock = 30_000;
    expect((await authorizer.isAuthorized(request)).allowed).toBe(false);
    clock = 61_000;
    expect((await authorizer.isAuthorized(request)).allowed).toBe(true);
    expect(loads).toBe(2);
  });
});

describe('pre token generation trigger', () => {
  it('copies the email into the access token and nothing else', async () => {
    const event = { request: { userAttributes: { email: 'carlos@studio.test', sub: 'abc' } }, response: {} };
    expect((await preTokenGeneration(event)).response).toEqual({
      claimsAndScopeOverrideDetails: { accessTokenGeneration: { claimsToAddOrOverride: { email: 'carlos@studio.test' } } },
    });
    expect((await preTokenGeneration({ request: { userAttributes: {} }, response: {} })).response).toEqual({});
  });
});
