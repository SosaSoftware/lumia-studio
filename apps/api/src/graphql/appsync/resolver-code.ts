/** Resolver code (APPSYNC_JS) shared by every field: passes the call to the Lambda and raises its errors with their type. */
export const APPSYNC_RESOLVER_CODE = `import { util } from '@aws-appsync/utils';

export function request(ctx) {
  return {
    operation: 'Invoke',
    payload: {
      arguments: ctx.arguments,
      identity: ctx.identity,
      source: ctx.source,
      info: { fieldName: ctx.info.fieldName, parentTypeName: ctx.info.parentTypeName },
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error('Ocurrió un error interno.', 'InternalError');
  }
  if (ctx.result.error) {
    util.error(ctx.result.error.message, ctx.result.error.type);
  }
  return ctx.result.data;
}
`;
