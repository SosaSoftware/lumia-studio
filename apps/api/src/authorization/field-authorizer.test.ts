import { describe, expect, it } from 'vitest';
import { makeClaims } from '../../test/support/claims.ts';
import type { AppSyncResolverEvent } from '../graphql/appsync/appsync-event.ts';
import type { FieldDefinition } from '../graphql/appsync/field-registry.ts';
import { AppError } from '../shared/errors/index.ts';
import type { AuthorizationRequest, Authorizer } from './authorizer.ts';
import { FieldAuthorizer } from './field-authorizer.ts';
import type { ResourceLookup } from './resource-lookup.ts';

const claims = makeClaims({ studio_role: 'content_creator', studio_actions: ['documents.view'] });

class FakeAuthorizer implements Authorizer {
  public requests: AuthorizationRequest[] = [];
  public constructor(private readonly allowed: boolean) {}
  public isAuthorized(request: AuthorizationRequest): Promise<{ allowed: boolean; reasons: string[] }> {
    this.requests.push(request);
    return Promise.resolve({ allowed: this.allowed, reasons: [] });
  }
}

const lookup: ResourceLookup = {
  attributes: (_type, id) => Promise.resolve(id === 'n1' ? { category: 'c1', subcategory: 's1' } : null),
};

const eventWith = (raw: Record<string, unknown> | null, args: Record<string, unknown> = {}): AppSyncResolverEvent => ({
  arguments: args,
  identity: raw === null ? null : { sub: 'sub-1', claims: raw },
  source: null,
  info: { fieldName: 'f', parentTypeName: 'Query' },
  request: { headers: {} },
});

const field = (overrides: Partial<FieldDefinition>): FieldDefinition => ({ type: 'Query', field: 'f', action: 'documents.view', handler: 'h', ...overrides });

describe('FieldAuthorizer', () => {
  it('allows and returns the claims, with the scope of the record', async () => {
    const authorizer = new FakeAuthorizer(true);
    const result = await new FieldAuthorizer(authorizer, lookup).authorize(field({ resource: { type: 'node', idArg: 'nodeId' } }), eventWith({ ...claims }, { nodeId: 'n1' }));
    expect(result).toEqual(claims);
    expect(authorizer.requests[0]?.resource).toEqual({ type: 'node', id: 'n1', category: 'c1', subcategory: 's1' });
  });

  it('reads the resource id from a dotted argument path', async () => {
    const authorizer = new FakeAuthorizer(true);
    await new FieldAuthorizer(authorizer, lookup).authorize(field({ resource: { type: 'slide', idArg: 'input.slideId' } }), eventWith({ ...claims }, { input: { slideId: 'n1' } }));
    expect(authorizer.requests[0]?.resource).toMatchObject({ type: 'slide', id: 'n1' });
    await expect(
      new FieldAuthorizer(authorizer, lookup).authorize(field({ resource: { type: 'slide', idArg: 'input.slideId' } }), eventWith({ ...claims }, { input: null })),
    ).rejects.toMatchObject({ errorType: 'ValidationError' });
  });

  it('only requires identity when the action is null', async () => {
    const authorizer = new FakeAuthorizer(false);
    await new FieldAuthorizer(authorizer, lookup).authorize(field({ action: null }), eventWith({ ...claims }));
    expect(authorizer.requests).toHaveLength(0);
  });

  it('denies with the Spanish message', async () => {
    const failure = await new FieldAuthorizer(new FakeAuthorizer(false), lookup).authorize(field({}), eventWith({ ...claims })).catch((e: unknown) => e);
    expect(failure).toMatchObject({ errorType: 'Unauthorized', message: 'No tienes permiso para realizar esta acción.' });
  });

  it('returns NotFound when the record is missing', async () => {
    const failure = await new FieldAuthorizer(new FakeAuthorizer(true), lookup)
      .authorize(field({ resource: { type: 'node', idArg: 'nodeId' } }), eventWith({ ...claims }, { nodeId: 'zz' }))
      .catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(AppError);
    expect(failure).toMatchObject({ errorType: 'NotFound' });
  });

  it('rejects a missing identity and malformed claims', async () => {
    const sut = new FieldAuthorizer(new FakeAuthorizer(true), lookup);
    await expect(sut.authorize(field({}), eventWith(null))).rejects.toMatchObject({ errorType: 'Unauthorized' });
    await expect(sut.authorize(field({}), eventWith({ sub: 'u1' }))).rejects.toMatchObject({ errorType: 'Unauthorized' });
  });
});
