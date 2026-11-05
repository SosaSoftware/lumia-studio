import type { Logger } from './logger.ts';

/**
 * Routes the logs of the Strands SDK and of `@ag-ui/aws-strands` into Lumi's logger, so every line is JSON.
 * Both libraries log a message followed by free-form values; the values travel in `details`.
 */
export class LibraryLogBridge {
  public constructor(private readonly logger: Logger) {}

  public debug(...args: unknown[]): void {
    const [message, fields] = LibraryLogBridge.split(args);
    this.logger.debug(message, fields);
  }

  public info(...args: unknown[]): void {
    const [message, fields] = LibraryLogBridge.split(args);
    this.logger.info(message, fields);
  }

  public warn(...args: unknown[]): void {
    const [message, fields] = LibraryLogBridge.split(args);
    this.logger.warn(message, fields);
  }

  public error(...args: unknown[]): void {
    const [message, fields] = LibraryLogBridge.split(args);
    this.logger.error(message, fields);
  }

  private static split(args: readonly unknown[]): [string, Record<string, unknown> | undefined] {
    const [first, ...rest] = args;
    const message = typeof first === 'string' ? first : 'library log';
    const details = typeof first === 'string' ? rest : args;
    return [message, details.length === 0 ? undefined : { details }];
  }
}
