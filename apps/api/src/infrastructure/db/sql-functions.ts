const COLUMN = /^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?$/;

/**
 * A timestamp column as ISO 8601 in UTC with milliseconds (`2026-11-05T01:54:46.907Z`). The RDS Data API returns
 * timestamps in its own text format, which AppSync rejects as AWSDateTime, so the SQL formats them for both adapters.
 */
export function isoTimestamp(column: string): string {
  if (!COLUMN.test(column)) throw new Error(`Invalid column "${column}"`);
  return `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
}
