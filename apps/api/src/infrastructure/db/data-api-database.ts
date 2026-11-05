import { TypeHint } from '@aws-sdk/client-rds-data';
import type { Field, SqlParameter } from '@aws-sdk/client-rds-data';
import type { CloseableDatabase } from './closeable-database.ts';
import type { DataApiGateway } from './data-api-gateway.ts';
import type { Database } from './database.ts';
import { SqlParam } from './sql-param.ts';
import type { SqlParams, SqlTypeHint, SqlValue } from './sql-param.ts';
import { SqlTemplate } from './sql-template.ts';

export interface DataApiTarget {
  readonly resourceArn: string;
  readonly secretArn: string;
  readonly database: string;
}

const TYPE_HINTS: Readonly<Record<SqlTypeHint, TypeHint>> = {
  uuid: TypeHint.UUID,
  json: TypeHint.JSON,
  timestamp: TypeHint.TIMESTAMP,
  date: TypeHint.DATE,
  decimal: TypeHint.DECIMAL,
};

/** Adapter over the RDS Data API (Aurora Serverless v2 in AWS). Rows are read with `formatRecordsAs: "JSON"`. */
export class DataApiDatabase implements CloseableDatabase {
  public constructor(
    private readonly gateway: DataApiGateway,
    private readonly target: DataApiTarget,
    private readonly transactionId?: string,
  ) {}

  public async query<T>(sql: string, params: SqlParams = {}): Promise<T[]> {
    const output = await this.gateway.executeStatement({
      ...this.target,
      sql,
      parameters: DataApiDatabase.toParameters(sql, params),
      formatRecordsAs: 'JSON',
      // Numeric columns (geometry, durations) as JSON numbers, like the pg adapter; the Data API sends them as text by default.
      resultSetOptions: { decimalReturnType: 'DOUBLE_OR_LONG' },
      transactionId: this.transactionId,
    });
    if (output.formattedRecords === undefined || output.formattedRecords === '') {
      return [];
    }
    // The row shape is declared by the caller; the Data API returns plain JSON objects.
    return JSON.parse(output.formattedRecords) as T[];
  }

  public async execute(sql: string, params: SqlParams = {}): Promise<number> {
    const output = await this.gateway.executeStatement({
      ...this.target,
      sql,
      parameters: DataApiDatabase.toParameters(sql, params),
      transactionId: this.transactionId,
    });
    return output.numberOfRecordsUpdated ?? 0;
  }

  public async transaction<T>(work: (tx: Database) => Promise<T>): Promise<T> {
    if (this.transactionId !== undefined) {
      return work(this);
    }
    const begun = await this.gateway.beginTransaction(this.target);
    const transactionId = begun.transactionId;
    if (transactionId === undefined) {
      throw new Error('The Data API did not return a transaction id');
    }
    try {
      const value = await work(new DataApiDatabase(this.gateway, this.target, transactionId));
      await this.gateway.commitTransaction({ resourceArn: this.target.resourceArn, secretArn: this.target.secretArn, transactionId });
      return value;
    } catch (error) {
      try {
        await this.gateway.rollbackTransaction({ resourceArn: this.target.resourceArn, secretArn: this.target.secretArn, transactionId });
      } catch {
        // The original error is more useful; the Data API expires abandoned transactions on its own.
      }
      throw error;
    }
  }

  public close(): Promise<void> {
    return Promise.resolve();
  }

  private static toParameters(sql: string, params: SqlParams): SqlParameter[] {
    return SqlTemplate.parse(sql).paramNames.map((name) => {
      const value = params[name];
      if (value === undefined) {
        throw new Error(`Missing value for SQL parameter :${name}`);
      }
      return DataApiDatabase.toParameter(name, value);
    });
  }

  private static toParameter(name: string, value: SqlValue): SqlParameter {
    if (value instanceof SqlParam) {
      const typeHint = TYPE_HINTS[value.typeHint];
      if (value.value === null) {
        return { name, value: { isNull: true }, typeHint };
      }
      return { name, value: { stringValue: DataApiDatabase.format(value) }, typeHint };
    }
    return { name, value: DataApiDatabase.toField(value) };
  }

  /** The Data API expects `YYYY-MM-DD HH:MM:SS[.FFF]` for timestamps, not ISO 8601. */
  private static format(param: SqlParam): string {
    const text = String(param.value);
    return param.typeHint === 'timestamp' ? text.replace('T', ' ').replace(/Z$/, '') : text;
  }

  private static toField(value: string | number | boolean | null): Field {
    if (value === null) {
      return { isNull: true };
    }
    if (typeof value === 'string') {
      return { stringValue: value };
    }
    if (typeof value === 'boolean') {
      return { booleanValue: value };
    }
    return Number.isInteger(value) ? { longValue: value } : { doubleValue: value };
  }
}
