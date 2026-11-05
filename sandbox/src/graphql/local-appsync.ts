import { readFileSync } from 'node:fs';
import { makeExecutableSchema } from '@graphql-tools/schema';
import type { GraphQLSchema } from 'graphql';
import type { TokenIdentity } from '@lumia/api/auth';
import { AppError } from '@lumia/api/errors';
import type { AppSyncResolverEvent, FieldDefinition } from '@lumia/api/graphql';
import type { Logger } from '@lumia/api/log';
import type { FieldPipeline } from '@lumia/api/runtime';
import type { TokenVerifier } from '../auth/index.ts';
import { AWS_DEFINITIONS_SDL, awsScalars } from './aws-definitions.ts';

/** Everything the local pipeline needs to serve the API. */
export interface LocalAppSyncOptions {
  /** Path of the API's `schema.graphql`. */
  schemaPath: string;
  fields: readonly FieldDefinition[];
  /** The same steps as the Lambdas: access from the database, Cedar, then the handler. */
  pipeline: FieldPipeline;
  verifier: TokenVerifier;
  logger: Logger;
}

interface RequestContext {
  request: { headers: Headers };
}

/** Yoga may use its own `Request` implementation, so the check is structural. */
function isRequestContext(value: unknown): value is RequestContext {
  if (typeof value !== 'object' || value === null || !('request' in value)) {
    return false;
  }
  const request = value.request;
  return typeof request === 'object' && request !== null && 'headers' in request && request.headers instanceof Object && 'get' in request.headers;
}

/**
 * Runs the AppSync pipeline in process: identity, field authorization and handler.
 * The field registry is the single source for the resolvers.
 */
export class LocalAppSync {
  public constructor(private readonly options: LocalAppSyncOptions) {}

  /** @throws Error when the registry and the schema root fields do not match. */
  public buildSchema(): GraphQLSchema {
    const executable = this.options.fields;
    const fieldResolvers: Record<string, Record<string, unknown>> = {};
    for (const definition of executable) {
      const typeResolvers = fieldResolvers[definition.type] ?? {};
      fieldResolvers[definition.type] = typeResolvers;
      typeResolvers[definition.field] = (
        _source: unknown,
        args: Record<string, unknown>,
        context: unknown,
      ): Promise<unknown> => this.resolve(definition, args, context);
    }
    const schema = makeExecutableSchema({
      typeDefs: `${AWS_DEFINITIONS_SDL}\n${readFileSync(this.options.schemaPath, 'utf8')}`,
      resolvers: { ...awsScalars(), ...fieldResolvers },
    });
    this.assertCoverage(schema, executable);
    return schema;
  }

  private assertCoverage(schema: GraphQLSchema, executable: readonly FieldDefinition[]): void {
    const roots = [
      ['Query', schema.getQueryType()],
      ['Mutation', schema.getMutationType()],
    ] as const;
    for (const [name, type] of roots) {
      for (const field of Object.keys(type?.getFields() ?? {})) {
        if (!executable.some((definition) => definition.type === name && definition.field === field)) {
          throw new Error(`${name}.${field} is in the schema but not in the field registry`);
        }
      }
    }
  }

  private async resolve(
    definition: FieldDefinition,
    args: Record<string, unknown>,
    context: unknown,
  ): Promise<unknown> {
    const headers = isRequestContext(context) ? Object.fromEntries(context.request.headers.entries()) : {};
    try {
      // Like AppSync with Cognito: the verified token claims reach the pipeline, which reads the access from the database.
      const identity = await this.identify(headers.authorization);
      const event: AppSyncResolverEvent = {
        arguments: { ...args },
        identity: identity === null ? null : { sub: identity.sub, claims: { sub: identity.sub, email: identity.email } },
        source: null,
        info: { fieldName: definition.field, parentTypeName: definition.type },
        request: { headers },
      };
      return await this.options.pipeline.run(event);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.options.logger.error('Unhandled error in resolver', { field: `${definition.type}.${definition.field}`, error });
      throw AppError.internal('Ocurrió un error interno.');
    }
  }

  /** Returns who the verified token identifies, or null when the request carries no token. */
  private async identify(authorization: string | undefined): Promise<TokenIdentity | null> {
    if (authorization === undefined) {
      return null;
    }
    // AppSync takes the bare token; the web sends `Bearer <token>`. Both work here too.
    const match = /^(?:Bearer\s+)?(\S+)$/i.exec(authorization);
    if (match?.[1] === undefined) {
      throw AppError.unauthorized('La sesión no es válida o expiró.');
    }
    return this.options.verifier.verify(match[1]);
  }
}
