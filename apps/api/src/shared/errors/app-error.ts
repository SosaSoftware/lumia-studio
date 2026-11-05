/** Error categories that handlers map to GraphQL error types. */
export type AppErrorType = 'Unauthorized' | 'NotFound' | 'Conflict' | 'ValidationError' | 'InternalError';

/** Domain error carrying the category a handler reports to the caller. */
export class AppError extends Error {
  public constructor(
    public readonly errorType: AppErrorType,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'AppError';
  }

  public static unauthorized(message: string): AppError {
    return new AppError('Unauthorized', message);
  }

  public static notFound(message: string): AppError {
    return new AppError('NotFound', message);
  }

  public static conflict(message: string): AppError {
    return new AppError('Conflict', message);
  }

  public static internal(message: string): AppError {
    return new AppError('InternalError', message);
  }

  public static validation(message: string): AppError {
    return new AppError('ValidationError', message);
  }
}
