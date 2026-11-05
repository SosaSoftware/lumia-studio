import type {
  BeginTransactionCommandInput,
  CommitTransactionCommandInput,
  ExecuteStatementCommandInput,
  ExecuteStatementCommandOutput,
  RollbackTransactionCommandInput,
} from '@aws-sdk/client-rds-data';
import { describe, expect, it } from 'vitest';
import type { DataApiGateway } from './data-api-gateway.ts';
import { DataApiDatabase } from './data-api-database.ts';
import { SqlParam } from './sql-param.ts';
import { isoTimestamp } from './sql-functions.ts';

const TARGET = { resourceArn: 'arn:cluster', secretArn: 'arn:secret', database: 'lumia' };

/** Records every request and answers with canned output. */
class FakeGateway implements DataApiGateway {
  public readonly statements: ExecuteStatementCommandInput[] = [];
  public readonly begun: BeginTransactionCommandInput[] = [];
  public readonly committed: CommitTransactionCommandInput[] = [];
  public readonly rolledBack: RollbackTransactionCommandInput[] = [];
  public output: Partial<ExecuteStatementCommandOutput> = {};

  public executeStatement(input: ExecuteStatementCommandInput): Promise<ExecuteStatementCommandOutput> {
    this.statements.push(input);
    return Promise.resolve({ $metadata: {}, ...this.output });
  }

  public beginTransaction(input: BeginTransactionCommandInput): Promise<{ $metadata: object; transactionId: string }> {
    this.begun.push(input);
    return Promise.resolve({ $metadata: {}, transactionId: 'tx-1' });
  }

  public commitTransaction(input: CommitTransactionCommandInput): Promise<{ $metadata: object }> {
    this.committed.push(input);
    return Promise.resolve({ $metadata: {} });
  }

  public rollbackTransaction(input: RollbackTransactionCommandInput): Promise<{ $metadata: object }> {
    this.rolledBack.push(input);
    return Promise.resolve({ $metadata: {} });
  }
}

describe('DataApiDatabase', () => {
  it('sends the SQL with typed named parameters and reads rows as JSON', async () => {
    const gateway = new FakeGateway();
    gateway.output = { formattedRecords: '[{"id":"a","n":1}]' };
    const db = new DataApiDatabase(gateway, TARGET);

    const rows = await db.query<{ id: string; n: number }>(
      'select * from t where id = :id and n = :n and name = :name and ok = :ok and f = :f and x = :x and at = :at and d = :d and p = :p and j = :j',
      {
        id: SqlParam.uuid('11111111-1111-4111-8111-111111111111'),
        n: 3,
        name: 'ana',
        ok: true,
        f: 1.5,
        x: null,
        at: SqlParam.timestamp(new Date('2027-01-02T03:04:05.000Z')),
        d: SqlParam.date('2027-01-02'),
        p: SqlParam.decimal(12.5),
        j: SqlParam.json({ a: 1 }),
      },
    );

    expect(rows).toEqual([{ id: 'a', n: 1 }]);
    const request = gateway.statements[0];
    expect(request).toMatchObject({ ...TARGET, formatRecordsAs: 'JSON', transactionId: undefined });
    expect(request?.parameters).toEqual([
      { name: 'id', value: { stringValue: '11111111-1111-4111-8111-111111111111' }, typeHint: 'UUID' },
      { name: 'n', value: { longValue: 3 } },
      { name: 'name', value: { stringValue: 'ana' } },
      { name: 'ok', value: { booleanValue: true } },
      { name: 'f', value: { doubleValue: 1.5 } },
      { name: 'x', value: { isNull: true } },
      { name: 'at', value: { stringValue: '2027-01-02 03:04:05.000' }, typeHint: 'TIMESTAMP' },
      { name: 'd', value: { stringValue: '2027-01-02' }, typeHint: 'DATE' },
      { name: 'p', value: { stringValue: '12.5' }, typeHint: 'DECIMAL' },
      { name: 'j', value: { stringValue: '{"a":1}' }, typeHint: 'JSON' },
    ]);
  });

  it('sends a null typed parameter as null with its hint', async () => {
    const gateway = new FakeGateway();
    await new DataApiDatabase(gateway, TARGET).execute('update t set d = :d', { d: SqlParam.date(null) });
    expect(gateway.statements[0]?.parameters).toEqual([{ name: 'd', value: { isNull: true }, typeHint: 'DATE' }]);
  });

  it('returns no rows when the statement has no result set and reports updated rows', async () => {
    const gateway = new FakeGateway();
    gateway.output = { numberOfRecordsUpdated: 4 };
    const db = new DataApiDatabase(gateway, TARGET);
    expect(await db.query('select 1')).toEqual([]);
    expect(await db.execute('delete from t')).toBe(4);
    expect(gateway.statements[1]?.formatRecordsAs).toBeUndefined();
  });

  it('rejects a statement whose parameter has no value', async () => {
    const db = new DataApiDatabase(new FakeGateway(), TARGET);
    await expect(db.query('select :missing')).rejects.toThrow(':missing');
  });

  it('runs transaction work inside one Data API transaction and commits', async () => {
    const gateway = new FakeGateway();
    const db = new DataApiDatabase(gateway, TARGET);
    const result = await db.transaction(async (tx) => {
      await tx.execute('insert into t values (1)');
      await tx.transaction((nested) => nested.execute('insert into t values (2)'));
      return 'done';
    });

    expect(result).toBe('done');
    expect(gateway.begun).toEqual([TARGET]);
    expect(gateway.statements.map((s) => s.transactionId)).toEqual(['tx-1', 'tx-1']);
    expect(gateway.committed).toEqual([{ resourceArn: 'arn:cluster', secretArn: 'arn:secret', transactionId: 'tx-1' }]);
    expect(gateway.rolledBack).toEqual([]);
  });

  it('rolls back and rethrows when the work fails', async () => {
    const gateway = new FakeGateway();
    const db = new DataApiDatabase(gateway, TARGET);
    await expect(
      db.transaction(() => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');
    expect(gateway.committed).toEqual([]);
    expect(gateway.rolledBack).toEqual([{ resourceArn: 'arn:cluster', secretArn: 'arn:secret', transactionId: 'tx-1' }]);
  });
});

describe('values shared with the pg adapter', () => {
  it('asks the Data API for numeric columns as numbers', async () => {
    const gateway = new FakeGateway();
    await new DataApiDatabase(gateway, TARGET).query('select 1');
    expect(gateway.statements[0]?.resultSetOptions).toEqual({ decimalReturnType: 'DOUBLE_OR_LONG' });
  });

  it('formats timestamps as ISO 8601 in UTC in SQL, and only for column names', () => {
    expect(isoTimestamp('v.created_at')).toBe(`to_char(v.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`);
    expect(() => isoTimestamp('created_at; drop table x')).toThrow();
  });
});
