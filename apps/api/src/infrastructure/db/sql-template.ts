export type SqlSegment =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'param'; readonly name: string };

const IDENTIFIER_START = /[A-Za-z_]/;
const DOLLAR_TAG = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/;

/**
 * SQL text split into literal segments and named parameters (`:name`).
 * The scanner skips quoted strings and identifiers, comments, dollar-quoted bodies
 * and `::` casts, so only real parameters are detected.
 */
export class SqlTemplate {
  private constructor(public readonly segments: readonly SqlSegment[]) {}

  public static parse(sql: string): SqlTemplate {
    const segments: SqlSegment[] = [];
    let textStart = 0;
    let i = 0;

    const flush = (end: number): void => {
      if (end > textStart) {
        segments.push({ kind: 'text', value: sql.slice(textStart, end) });
      }
    };

    while (i < sql.length) {
      const char = sql.charAt(i);
      const next = sql.charAt(i + 1);
      if (char === "'" || char === '"') {
        i = SqlTemplate.skipQuoted(sql, i, char);
      } else if (char === '-' && next === '-') {
        const end = sql.indexOf('\n', i);
        i = end === -1 ? sql.length : end + 1;
      } else if (char === '/' && next === '*') {
        const end = sql.indexOf('*/', i + 2);
        i = end === -1 ? sql.length : end + 2;
      } else if (char === '$') {
        const tag = DOLLAR_TAG.exec(sql.slice(i));
        if (tag === null) {
          i += 1;
        } else {
          const end = sql.indexOf(tag[0], i + tag[0].length);
          i = end === -1 ? sql.length : end + tag[0].length;
        }
      } else if (char === ':' && next === ':') {
        i += 2;
      } else if (char === ':' && IDENTIFIER_START.test(next)) {
        let end = i + 2;
        while (end < sql.length && /[A-Za-z0-9_]/.test(sql.charAt(end))) {
          end += 1;
        }
        flush(i);
        segments.push({ kind: 'param', name: sql.slice(i + 1, end) });
        textStart = end;
        i = end;
      } else {
        i += 1;
      }
    }
    flush(sql.length);
    return new SqlTemplate(segments);
  }

  /** Distinct parameter names in order of first appearance. */
  public get paramNames(): string[] {
    const names = new Set<string>();
    for (const segment of this.segments) {
      if (segment.kind === 'param') {
        names.add(segment.name);
      }
    }
    return [...names];
  }

  private static skipQuoted(sql: string, start: number, quote: string): number {
    let i = start + 1;
    while (i < sql.length) {
      if (sql.charAt(i) === quote) {
        if (sql.charAt(i + 1) === quote) {
          i += 2;
          continue;
        }
        return i + 1;
      }
      i += 1;
    }
    return sql.length;
  }
}
