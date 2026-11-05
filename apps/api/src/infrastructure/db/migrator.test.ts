import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Database } from './database.ts';
import { countStatements, Migrator, splitStatements } from './migrator.ts';

describe('splitStatements', () => {
  it('splits on lines that contain only --; and drops empty chunks', () => {
    const sql = 'create table a (id int)\n--;\n\ncreate table b (id int)\n--;\n';
    expect(splitStatements(sql)).toEqual(['create table a (id int)', 'create table b (id int)']);
  });

  it('keeps a trailing --; comment inside a statement line untouched', () => {
    expect(splitStatements('select 1 -- not a separator;')).toEqual(['select 1 -- not a separator;']);
  });

  it('keeps dollar-quoted bodies with semicolons in one statement', () => {
    const body = 'do $$\nbegin\n  perform 1;\nend\n$$';
    expect(splitStatements(`${body}\n--;\nselect 2`)).toEqual([body, 'select 2']);
  });
});

/** Reading the migration files does not touch the database. */
const UNUSED_DB: Database = {
  query: () => Promise.resolve([]),
  execute: () => Promise.resolve(0),
  transaction: (work) => work(UNUSED_DB),
};

describe('one statement per chunk (the RDS Data API runs one per call)', () => {
  it('counts statements outside strings, dollar-quoted bodies and comments', () => {
    expect(countStatements('select 1;')).toBe(1);
    expect(countStatements('select 1')).toBe(1);
    expect(countStatements('alter table a add x int; alter table b add y int;')).toBe(2);
    expect(countStatements("select ';' as a; -- one; two;\n/* three; */")).toBe(1);
    expect(countStatements('do $$ begin perform 1; perform 2; end $$;')).toBe(1);
    expect(countStatements('create function f() returns int as $body$ select 1; $body$ language sql;')).toBe(1);
    expect(countStatements('-- only a comment')).toBe(0);
  });

  it('rejects a migration chunk with two statements', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'lumia-migrations-'));
    try {
      await writeFile(path.join(directory, '0001_two.sql'), 'alter table a add x int;\nalter table b add y int;\n');
      await expect(new Migrator(UNUSED_DB, 'studio', directory).readFiles()).rejects.toThrow(/0001_two\.sql", statement 1/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('holds for every migration of the repository', async () => {
    const files = await new Migrator(UNUSED_DB, 'studio', fileURLToPath(new URL('../../../db/migrations', import.meta.url))).readFiles();
    expect(files.length).toBeGreaterThan(7);
    for (const file of files) for (const statement of file.statements) expect(countStatements(statement)).toBe(1);
  });
});
