import type { Database, SqlParams } from '../../src/infrastructure/db/index.ts';

export interface RecordedStatement {
  sql: string;
  params: SqlParams;
}

/** `Database` for unit tests: answers queries from canned rows matched by a fragment of the SQL and records every statement. */
export class ScriptedDatabase implements Database {
  public readonly statements: RecordedStatement[] = [];
  public transactions = 0;

  public constructor(private readonly answers: readonly { match: string; rows: readonly unknown[]; when?: (params: SqlParams) => boolean }[] = []) {}

  public query<T>(sql: string, params: SqlParams = {}): Promise<T[]> {
    this.statements.push({ sql, params });
    const answer = this.answers.find((candidate) => sql.includes(candidate.match) && (candidate.when?.(params) ?? true));
    // The test declares the row shape of each canned answer.
    return Promise.resolve((answer?.rows ?? []) as T[]);
  }

  public execute(sql: string, params: SqlParams = {}): Promise<number> {
    this.statements.push({ sql, params });
    return Promise.resolve(1);
  }

  public async transaction<T>(work: (tx: Database) => Promise<T>): Promise<T> {
    this.transactions += 1;
    return work(this);
  }

  public ran(fragment: string): boolean {
    return this.statements.some((statement) => statement.sql.includes(fragment));
  }
}
