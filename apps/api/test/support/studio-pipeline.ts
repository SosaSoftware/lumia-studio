import type { StudioClaims } from '../../src/auth/index.ts';
import { FieldAuthorizer, LocalCedarAuthorizer, loadCedarSchema, RolePolicies, StudioResourceLookup } from '../../src/authorization/index.ts';
import type { AppSyncResolverEvent } from '../../src/graphql/index.ts';
import { STUDIO_FIELDS } from '../../src/graphql/index.ts';
import { HANDLERS } from '../../src/handlers/index.ts';
import type { Database } from '../../src/infrastructure/db/index.ts';

/** The local server pipeline in process: field lookup, Cedar authorization with the roles of the database, and handler. */
export class StudioPipeline {
  private constructor(private readonly authorizer: FieldAuthorizer) {}

  /** Loads the role policies now; create the pipeline after the test roles exist. */
  public static async create(db: Database): Promise<StudioPipeline> {
    const cedar = new LocalCedarAuthorizer(await new RolePolicies(db).load(), loadCedarSchema());
    return new StudioPipeline(new FieldAuthorizer(cedar, new StudioResourceLookup(db)));
  }

  public async run(claims: StudioClaims | null, type: 'Query' | 'Mutation', field: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const definition = STUDIO_FIELDS.find((candidate) => candidate.type === type && candidate.field === field);
    const handler = definition === undefined ? undefined : HANDLERS[definition.handler];
    if (definition === undefined || handler === undefined) {
      throw new Error(`Field ${type}.${field} is not registered`);
    }
    const event: AppSyncResolverEvent = {
      arguments: args,
      identity: claims === null ? null : { sub: claims.sub, claims: { ...claims } },
      source: null,
      info: { fieldName: field, parentTypeName: type },
      request: { headers: { authorization: 'Bearer test-token' } },
    };
    await this.authorizer.authorize(definition, event);
    return handler(event);
  }
}
