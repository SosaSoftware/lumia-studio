import type { StudioClaims } from '../auth/index.ts';
import type { AppSyncResolverEvent } from '../graphql/appsync/appsync-event.ts';
import type { FieldDefinition } from '../graphql/appsync/field-registry.ts';
import { AppError } from '../shared/errors/index.ts';
import type { AuthorizationRequest, Authorizer } from './authorizer.ts';
import { parseStudioClaims } from './parse-claims.ts';
import type { ResourceLookup } from './resource-lookup.ts';

const DENIED_MESSAGE = 'No tienes permiso para realizar esta acción.';

/** Authorization of a field: identity, scope of the record and Cedar decision. */
export class FieldAuthorizer {
  public constructor(
    private readonly authorizer: Authorizer,
    private readonly lookup: ResourceLookup,
  ) {}

  /** Returns the verified claims, or throws `AppError` when the caller may not execute the field. */
  public async authorize(definition: FieldDefinition, event: AppSyncResolverEvent): Promise<StudioClaims> {
    const raw = event.identity?.claims;
    const claims = raw === undefined ? null : parseStudioClaims(raw);
    if (claims === null) {
      throw AppError.unauthorized(DENIED_MESSAGE);
    }
    if (definition.action === null) {
      return claims;
    }
    const resource = await this.resolveResource(definition, event);
    const decision = await this.authorizer.isAuthorized({
      claims,
      action: definition.action,
      ...(resource === undefined ? {} : { resource }),
    });
    if (!decision.allowed) {
      throw AppError.unauthorized(DENIED_MESSAGE);
    }
    return claims;
  }

  /** Reads an argument by name or by dotted path (`input.slideId`) so input objects can carry the resource id. */
  private static readArgument(args: Readonly<Record<string, unknown>>, path: string): unknown {
    let current: unknown = args;
    for (const segment of path.split('.')) {
      if (typeof current !== 'object' || current === null) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[segment]; // narrowed to a non-null object above
    }
    return current;
  }

  private async resolveResource(definition: FieldDefinition, event: AppSyncResolverEvent): Promise<AuthorizationRequest['resource']> {
    if (definition.resource === undefined) {
      return undefined;
    }
    const { type, idArg } = definition.resource;
    const id = FieldAuthorizer.readArgument(event.arguments, idArg);
    if (typeof id !== 'string' || id === '') {
      throw AppError.validation(`Falta el argumento ${idArg}.`);
    }
    const attributes = await this.lookup.attributes(type, id);
    if (attributes === null) {
      throw AppError.notFound('El recurso solicitado no existe.');
    }
    return { type, id, ...attributes };
  }
}
