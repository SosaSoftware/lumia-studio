import { ClaimsBuilder, ClaimsResolver, tokenIdentity } from '../auth/index.ts';
import { FieldAuthorizer, RefreshingCedarAuthorizer, RolePolicies, StudioResourceLookup, loadCedarSchema } from '../authorization/index.ts';
import type { AppSyncResolverEvent, FieldDefinition } from '../graphql/appsync/index.ts';
import type { Database } from '../infrastructure/db/index.ts';
import { AppError } from '../shared/errors/index.ts';

/** Resolver of one field family; the handlers of `handlers/` have this shape. */
export type FieldHandler = (event: AppSyncResolverEvent) => Promise<unknown>;

export interface FieldPipelineOptions {
  readonly fields: readonly FieldDefinition[];
  readonly handlers: Readonly<Record<string, FieldHandler>>;
  readonly claims: ClaimsResolver;
  readonly authorizer: FieldAuthorizer;
}

const INVALID_SESSION = 'La sesión no es válida o expiró.';

/**
 * Runs a field as the caller: the token only identifies the person; their role, actions and access come from the
 * database; Cedar decides; then the handler runs with those claims. The sandbox and the Lambdas use the same steps.
 */
export class FieldPipeline {
  public constructor(private readonly options: FieldPipelineOptions) {}

  /** The pipeline of Studio on a database: claims and role policies read from it, each cached for a minute. */
  public static on(db: Database, fields: readonly FieldDefinition[], handlers: Readonly<Record<string, FieldHandler>>): FieldPipeline {
    return new FieldPipeline({
      fields,
      handlers,
      claims: new ClaimsResolver(new ClaimsBuilder(db)),
      authorizer: new FieldAuthorizer(new RefreshingCedarAuthorizer(new RolePolicies(db), loadCedarSchema()), new StudioResourceLookup(db)),
    });
  }

  /** @throws AppError when the caller may not run the field, and whatever the handler throws. */
  public async run(event: AppSyncResolverEvent): Promise<unknown> {
    const { parentTypeName, fieldName } = event.info;
    const definition = this.options.fields.find((candidate) => candidate.type === parentTypeName && candidate.field === fieldName);
    const handler = definition === undefined ? undefined : this.options.handlers[definition.handler];
    if (definition === undefined || handler === undefined) {
      throw AppError.internal('Operación no disponible.');
    }
    const identity = tokenIdentity(event.identity?.claims);
    if (identity === null) {
      throw AppError.unauthorized(INVALID_SESSION);
    }
    const claims = await this.options.claims.resolve(identity);
    const authorized: AppSyncResolverEvent = { ...event, identity: { sub: claims.sub, claims: { ...claims } } };
    await this.options.authorizer.authorize(definition, authorized);
    return handler(authorized);
  }
}
