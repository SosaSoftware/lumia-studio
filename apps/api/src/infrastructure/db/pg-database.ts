import pg from 'pg';
import type { CloseableDatabase } from './closeable-database.ts';
import type { Database } from './database.ts';
import { SqlParam } from './sql-param.ts';
import type { SqlParams, SqlTypeHint, SqlValue } from './sql-param.ts';
import { SqlTemplate } from './sql-template.ts';

export interface PgConnectionOptions {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
}

type TypeId = Parameters<typeof pg.types.getTypeParser>[0];

type RunQuery = (text: string, values: unknown[]) => Promise<pg.QueryResult>;

const CASTS: Readonly<Record<SqlTypeHint, string>> = {
  uuid: 'uuid',
  json: 'jsonb',
  timestamp: 'timestamptz',
  date: 'date',
  decimal: 'numeric',
};

const BUILTINS = pg.types.builtins;

/**
 * Makes `pg` return the same shapes as the RDS Data API in JSON mode:
 * 64-bit integers and numerics as numbers, dates and timestamps as strings.
 */
const TYPE_PARSERS = {
  getTypeParser(oid: TypeId, format?: string): (value: string) => unknown {
    switch (oid) {
      case BUILTINS.INT8:
      case BUILTINS.NUMERIC:
        return (value: string): unknown => Number(value);
      case BUILTINS.DATE:
      case BUILTINS.TIMESTAMP:
        return (value: string): unknown => value;
      case BUILTINS.TIMESTAMPTZ:
        return (value: string): unknown => new Date(value).toISOString();
      default:
        return pg.types.getTypeParser(oid, format === 'binary' ? 'binary' : 'text') as (value: string) => unknown;
    }
  },
};

/** Postgres adapter used by the local sandbox. Named parameters are rewritten to `$n` placeholders. */
export class PgDatabase implements CloseableDatabase {
  private constructor(
    private readonly run: RunQuery,
    private readonly pool: pg.Pool | undefined,
  ) {}

  public static connect(options: PgConnectionOptions): PgDatabase {
    const pool = new pg.Pool({ ...options, types: TYPE_PARSERS });
    return new PgDatabase((text, values) => pool.query(text, values), pool);
  }

  public async query<T>(sql: string, params: SqlParams = {}): Promise<T[]> {
    const result = await this.execStatement(sql, params);
    // The row shape is declared by the caller; pg returns plain objects.
    return result.rows as T[];
  }

  public async execute(sql: string, params: SqlParams = {}): Promise<number> {
    const result = await this.execStatement(sql, params);
    return result.rowCount ?? 0;
  }

  public async transaction<T>(work: (tx: Database) => Promise<T>): Promise<T> {
    if (this.pool === undefined) {
      // Already inside a transaction: join it.
      return work(this);
    }
    const client = await this.pool.connect();
    let brokenConnection: Error | undefined;
    try {
      await client.query('begin');
      const tx = new PgDatabase((text, values) => client.query(text, values), undefined);
      const value = await work(tx);
      await client.query('commit');
      return value;
    } catch (error) {
      try {
        await client.query('rollback');
      } catch (rollbackError) {
        // Keep the original error; a failed rollback means the connection must not return to the pool.
        brokenConnection = rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError));
      }
      throw error;
    } finally {
      client.release(brokenConnection);
    }
  }

  public async close(): Promise<void> {
    await this.pool?.end();
  }

  private execStatement(sql: string, params: SqlParams): Promise<pg.QueryResult> {
    const template = SqlTemplate.parse(sql);
    if (template.paramNames.length === 0) {
      return this.run(sql, []);
    }
    const positions = new Map<string, number>();
    const values: unknown[] = [];
    let text = '';
    for (const segment of template.segments) {
      if (segment.kind === 'text') {
        text += segment.value;
        continue;
      }
      const value = PgDatabase.lookup(params, segment.name);
      let position = positions.get(segment.name);
      if (position === undefined) {
        values.push(value instanceof SqlParam ? value.value : value);
        position = values.length;
        positions.set(segment.name, position);
      }
      text += `$${String(position)}${value instanceof SqlParam ? `::${CASTS[value.typeHint]}` : ''}`;
    }
    return this.run(text, values);
  }

  private static lookup(params: SqlParams, name: string): SqlValue {
    const value = params[name];
    if (value === undefined) {
      throw new Error(`Missing value for SQL parameter :${name}`);
    }
    return value;
  }
}
