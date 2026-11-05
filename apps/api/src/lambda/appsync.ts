import type { AppSyncIdentity, AppSyncResolverEvent } from '../graphql/appsync/index.ts';
import { STUDIO_FIELDS } from '../graphql/fields.ts';
import { HANDLERS } from '../handlers/index.ts';
import { FieldPipeline } from '../runtime/field-pipeline.ts';
import { StudioRuntime } from '../runtime/studio-runtime.ts';
import { AppError } from '../shared/errors/index.ts';
import type { AppErrorType } from '../shared/errors/index.ts';

/**
 * What a resolver Lambda answers. AppSync shows `errorType` only when the resolver raises it, so errors travel as
 * data and the JavaScript resolver calls `util.error(message, type)` (see `graphql/appsync/resolver-code.ts`).
 */
export type AppSyncLambdaResult = { readonly data: unknown } | { readonly error: { readonly type: AppErrorType; readonly message: string } };

/** Handler of one AppSync Lambda data source. */
export type AppSyncLambdaHandler = (event: unknown) => Promise<AppSyncLambdaResult>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads the payload of the resolver; the token claims stay as they are and the pipeline reads only the identity. */
function resolverEvent(payload: unknown): AppSyncResolverEvent {
  const event = isRecord(payload) ? payload : {};
  const info = isRecord(event.info) ? event.info : {};
  const identity = isRecord(event.identity) && isRecord(event.identity.claims) ? event.identity : null;
  const sub = identity !== null && typeof identity.sub === 'string' ? identity.sub : '';
  const claims = identity !== null && isRecord(identity.claims) ? identity.claims : {};
  const caller: AppSyncIdentity | null = identity === null ? null : { sub, claims };
  return {
    arguments: isRecord(event.arguments) ? event.arguments : {},
    identity: caller,
    source: isRecord(event.source) ? event.source : null,
    info: {
      fieldName: typeof info.fieldName === 'string' ? info.fieldName : '',
      parentTypeName: typeof info.parentTypeName === 'string' ? info.parentTypeName : '',
    },
    // The token stays in AppSync; the handlers do not need it.
    request: { headers: {} },
  };
}

/** Lambda handler of one data source; it only serves the fields that `STUDIO_FIELDS` sends to `name`. */
export function appSyncHandler(name: string, runtime: () => StudioRuntime = () => StudioRuntime.current()): AppSyncLambdaHandler {
  const handler = HANDLERS[name];
  if (handler === undefined) throw new Error(`Unknown handler "${name}"`);
  const fields = STUDIO_FIELDS.filter((field) => field.handler === name);
  let pipeline: FieldPipeline | undefined;
  return async (payload: unknown): Promise<AppSyncLambdaResult> => {
    const shared = runtime();
    pipeline ??= FieldPipeline.on(shared.db, fields, { [name]: handler });
    const event = resolverEvent(payload);
    try {
      return { data: await pipeline.run(event) };
    } catch (error) {
      if (error instanceof AppError) {
        return { error: { type: error.errorType, message: error.message } };
      }
      shared.logger.error('Unhandled error in resolver', {
        field: `${event.info.parentTypeName}.${event.info.fieldName}`,
        error: error instanceof Error ? error.message : 'unknown error',
      });
      return { error: { type: 'InternalError', message: 'Ocurrió un error interno.' } };
    }
  };
}

export const documents: AppSyncLambdaHandler = appSyncHandler('documents');
export const media: AppSyncLambdaHandler = appSyncHandler('media');
export const narration: AppSyncLambdaHandler = appSyncHandler('narration');
export const publish: AppSyncLambdaHandler = appSyncHandler('publish');
export const tree: AppSyncLambdaHandler = appSyncHandler('tree');
