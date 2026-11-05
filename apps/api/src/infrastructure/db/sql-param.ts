/** Type hints required by the RDS Data API for values that are not plain strings or numbers. */
export type SqlTypeHint = 'uuid' | 'json' | 'timestamp' | 'date' | 'decimal';

export type SqlScalar = string | number | boolean | null;

/**
 * A parameter value with an explicit type hint.
 * The RDS Data API cannot infer UUID, JSON, date and decimal types, so they must be declared.
 * Array parameters are not used: list filters pass comma-separated text and use `string_to_array`.
 */
export class SqlParam {
  private constructor(
    public readonly value: SqlScalar,
    public readonly typeHint: SqlTypeHint,
  ) {}

  public static uuid(value: string | null): SqlParam {
    return new SqlParam(value, 'uuid');
  }

  public static json(value: unknown): SqlParam {
    return new SqlParam(value === null ? null : JSON.stringify(value), 'json');
  }

  public static timestamp(value: Date | string | null): SqlParam {
    return new SqlParam(value instanceof Date ? value.toISOString() : value, 'timestamp');
  }

  public static date(value: string | null): SqlParam {
    return new SqlParam(value, 'date');
  }

  public static decimal(value: number | string | null): SqlParam {
    return new SqlParam(value === null ? null : String(value), 'decimal');
  }
}

export type SqlValue = SqlScalar | SqlParam;

export type SqlParams = Readonly<Record<string, SqlValue>>;
