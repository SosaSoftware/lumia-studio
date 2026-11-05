import { GraphQLError } from 'graphql';
import type { ExecutionResult } from 'graphql';
import { AppError } from '@lumia/api/errors';

/** Result carrying the serializer that yoga calls instead of `JSON.stringify`. */
export type AppSyncResult = ExecutionResult & { stringify: (result: ExecutionResult) => string };

/** Formats GraphQL errors the way AppSync does: `errorType` next to the message. */
// Only static members: the format is stateless and yoga needs plain functions.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AppSyncErrors {
  /** Maps any execution error to a Spanish message and an `errorType`; internal details never reach the client. */
  public static normalize(error: GraphQLError): GraphQLError {
    const original: unknown = error.cause;
    let errorType = 'ValidationError';
    let message = error.message;
    if (original instanceof AppError) {
      errorType = original.errorType;
      message = original.message;
    } else if (original !== undefined && original !== null) {
      errorType = 'InternalError';
      message = 'Ocurrió un error interno.';
    }
    return new GraphQLError(message, {
      nodes: error.nodes,
      source: error.source,
      positions: error.positions,
      path: error.path,
      extensions: { errorType },
    });
  }

  /** Returns the result with normalized errors and the AppSync serializer. */
  public static format(result: ExecutionResult): AppSyncResult {
    return {
      ...result,
      ...(result.errors === undefined ? {} : { errors: result.errors.map((error) => AppSyncErrors.normalize(error)) }),
      stringify: (value) => AppSyncErrors.stringify(value),
    };
  }

  private static stringify(result: ExecutionResult): string {
    return JSON.stringify({
      ...result,
      ...(result.errors === undefined
        ? {}
        : {
            errors: result.errors.map((error) => ({
              errorType: error.extensions.errorType,
              message: error.message,
              ...(error.locations === undefined ? {} : { locations: error.locations }),
              ...(error.path === undefined ? {} : { path: error.path }),
            })),
          }),
    });
  }
}
