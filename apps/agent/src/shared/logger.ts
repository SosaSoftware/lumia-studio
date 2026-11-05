import type { LumiLogLevel } from '@lumia/packages/lumi-env';

/** Structured fields of a log line. Never put tokens, prompts, messages or tool arguments in them. */
export type LogFields = Readonly<Record<string, unknown>>;

/** Logger of Lumi: one JSON object per line. */
export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  /** A logger whose lines also carry `fields`. */
  child(fields: LogFields): Logger;
}

/** Where a log line goes; by default standard output, or standard error for warnings and errors. */
export type LogSink = (line: string, level: LumiLogLevel) => void;

const RANK: Readonly<Record<LumiLogLevel, number>> = { debug: 10, info: 20, warn: 30, error: 40 };

const DEFAULT_SINK: LogSink = (line, level) => {
  if (RANK[level] >= RANK.warn) {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
};

/** Errors become `{ name, message, stack }`, which `JSON.stringify` would otherwise print as `{}`. */
function serializable(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, ...(value.stack === undefined ? {} : { stack: value.stack }) };
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}

/**
 * Writes JSON lines with a timestamp, the level and the message, for CloudWatch and local logs alike.
 * Lines below the configured level are dropped.
 */
export class JsonLogger implements Logger {
  private readonly threshold: number;

  public constructor(
    private readonly level: LumiLogLevel,
    private readonly fields: LogFields = {},
    private readonly sink: LogSink = DEFAULT_SINK,
  ) {
    this.threshold = RANK[level];
  }

  public debug(message: string, fields?: LogFields): void {
    this.write('debug', message, fields);
  }

  public info(message: string, fields?: LogFields): void {
    this.write('info', message, fields);
  }

  public warn(message: string, fields?: LogFields): void {
    this.write('warn', message, fields);
  }

  public error(message: string, fields?: LogFields): void {
    this.write('error', message, fields);
  }

  public child(fields: LogFields): Logger {
    return new JsonLogger(this.level, { ...this.fields, ...fields }, this.sink);
  }

  private write(level: LumiLogLevel, message: string, fields: LogFields | undefined): void {
    if (RANK[level] < this.threshold) {
      return;
    }
    const entry = { time: new Date().toISOString(), level, message, ...this.fields, ...fields };
    let line: string;
    try {
      line = JSON.stringify(entry, serializable);
    } catch (error) {
      // A circular field must not lose the line: keep the message and say why the fields are missing.
      line = JSON.stringify({ time: entry.time, level, message, logError: error instanceof Error ? error.message : 'unserializable fields' });
    }
    this.sink(line, level);
  }
}
