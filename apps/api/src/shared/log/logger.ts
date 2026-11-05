export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFields = Readonly<Record<string, unknown>>;

/** Destination of serialized log lines. */
export interface LogSink {
  write(line: string): void;
}

/** Writes each line to standard output, where CloudWatch and the local server collect it. */
export class StdoutSink implements LogSink {
  public write(line: string): void {
    process.stdout.write(`${line}\n`);
  }
}

const LEVEL_RANK: Readonly<Record<LogLevel, number>> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Structured logger that emits one JSON object per line. */
export class Logger {
  public constructor(
    private readonly context: LogFields = {},
    private readonly sink: LogSink = new StdoutSink(),
    private readonly minLevel: LogLevel = 'info',
  ) {}

  /** Returns a logger that adds `fields` to every entry. */
  public child(fields: LogFields): Logger {
    return new Logger({ ...this.context, ...fields }, this.sink, this.minLevel);
  }

  public debug(message: string, fields?: LogFields): void {
    this.log('debug', message, fields);
  }

  public info(message: string, fields?: LogFields): void {
    this.log('info', message, fields);
  }

  public warn(message: string, fields?: LogFields): void {
    this.log('warn', message, fields);
  }

  public error(message: string, fields?: LogFields): void {
    this.log('error', message, fields);
  }

  private log(level: LogLevel, message: string, fields: LogFields = {}): void {
    if (LEVEL_RANK[level] < LEVEL_RANK[this.minLevel]) {
      return;
    }
    const entry = { level, message, time: new Date().toISOString(), ...this.context, ...Logger.serialize(fields) };
    this.sink.write(JSON.stringify(entry));
  }

  /** Errors have no enumerable properties, so they are expanded explicitly. */
  private static serialize(fields: LogFields): LogFields {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      result[key] = value instanceof Error ? { name: value.name, message: value.message, stack: value.stack } : value;
    }
    return result;
  }
}
