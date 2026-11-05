import type { SqlParams } from './sql-param.ts';

/**
 * Data access contract shared by every Lambda and script.
 * SQL uses named parameters (`:name`); rows are returned as plain objects.
 */
export interface Database {
  query<T>(sql: string, params?: SqlParams): Promise<T[]>;
  /** Runs a statement and returns the number of affected rows. */
  execute(sql: string, params?: SqlParams): Promise<number>;
  /** Runs `work` in one transaction; commits on success and rolls back on any error. */
  transaction<T>(work: (tx: Database) => Promise<T>): Promise<T>;
}
