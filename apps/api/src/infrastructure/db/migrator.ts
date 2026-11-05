import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Database } from './database.ts';

const FILE_PATTERN = /^(\d{4})_[a-z0-9_]+\.sql$/;
const SCHEMA_PATTERN = /^[a-z_][a-z0-9_]*$/;

export interface MigrationFile {
  readonly version: string;
  readonly statements: readonly string[];
}

/** Splits a migration into statements on lines that contain only `--;`. */
export function splitStatements(sql: string): string[] {
  return sql
    .split(/^[ \t]*--;[ \t]*\r?$/m)
    .map((statement) => statement.trim())
    .filter((statement) => statement !== '');
}

/** End of a quoted part that starts at `start` with `quote`; a doubled quote stays inside. */
function quotedEnd(sql: string, start: number, quote: string): number {
  let index = start + 1;
  while (index < sql.length) {
    if (sql[index] === quote) {
      if (sql[index + 1] !== quote) return index + 1;
      index += 2;
    } else {
      index += 1;
    }
  }
  return sql.length;
}

/**
 * Number of SQL statements in a chunk: semicolons outside strings, quoted names, dollar-quoted bodies and comments,
 * plus a last statement without one. The RDS Data API runs one statement per call, so each chunk must hold one.
 */
export function countStatements(sql: string): number {
  let statements = 0;
  let pending = false;
  let index = 0;
  while (index < sql.length) {
    const rest = sql.slice(index);
    if (rest.startsWith('--')) {
      const end = sql.indexOf('\n', index);
      index = end === -1 ? sql.length : end;
      continue;
    }
    if (rest.startsWith('/*')) {
      const end = sql.indexOf('*/', index + 2);
      index = end === -1 ? sql.length : end + 2;
      continue;
    }
    const char = sql.charAt(index);
    if (char === "'" || char === '"') {
      index = quotedEnd(sql, index, char);
      pending = true;
      continue;
    }
    const tag = /^\$[A-Za-z_]*\$/.exec(rest)?.[0];
    if (tag !== undefined) {
      const end = sql.indexOf(tag, index + tag.length);
      index = end === -1 ? sql.length : end + tag.length;
      pending = true;
      continue;
    }
    if (char === ';') {
      statements += 1;
      pending = false;
    } else if (!/\s/.test(char)) {
      pending = true;
    }
    index += 1;
  }
  return statements + (pending ? 1 : 0);
}

/**
 * Applies `NNNN_<name>.sql` files of one directory in order, each in its own transaction,
 * and records them in `<schema>.schema_migration`. Applied files are never run again.
 */
export class Migrator {
  public constructor(
    private readonly db: Database,
    private readonly schema: string,
    private readonly directory: string,
  ) {
    if (!SCHEMA_PATTERN.test(schema)) {
      throw new Error(`Invalid schema name "${schema}"`);
    }
  }

  /** Returns the versions applied by this run. */
  public async run(): Promise<string[]> {
    await this.ensureTrackingTable();
    const applied = new Set(
      (await this.db.query<{ version: string }>(`select version from ${this.schema}.schema_migration`)).map((row) => row.version),
    );
    const done: string[] = [];
    for (const file of await this.readFiles()) {
      if (applied.has(file.version)) {
        continue;
      }
      await this.db.transaction(async (tx) => {
        for (const statement of file.statements) {
          await tx.execute(statement);
        }
        await tx.execute(`insert into ${this.schema}.schema_migration (version) values (:version)`, { version: file.version });
      });
      done.push(file.version);
    }
    return done;
  }

  public async readFiles(): Promise<MigrationFile[]> {
    const names = (await readdir(this.directory)).filter((name) => name.endsWith('.sql')).sort();
    const files: MigrationFile[] = [];
    for (const name of names) {
      if (!FILE_PATTERN.test(name)) {
        throw new Error(`Migration file "${name}" does not match NNNN_<name>.sql`);
      }
      const sql = await readFile(path.join(this.directory, name), 'utf8');
      const statements = splitStatements(sql);
      statements.forEach((statement, index) => {
        if (countStatements(statement) > 1) {
          throw new Error(`Migration "${name}", statement ${String(index + 1)}: separate each SQL statement with a line that holds only --;`);
        }
      });
      files.push({ version: name.replace(/\.sql$/, ''), statements });
    }
    return files;
  }

  private async ensureTrackingTable(): Promise<void> {
    await this.db.execute(`create schema if not exists ${this.schema}`);
    await this.db.execute(
      `create table if not exists ${this.schema}.schema_migration (version text primary key, applied_at timestamptz not null default now())`,
    );
  }
}
