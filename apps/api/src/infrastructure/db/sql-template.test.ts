import { describe, expect, it } from 'vitest';
import { SqlTemplate } from './sql-template.ts';

describe('SqlTemplate', () => {
  it('detects named parameters in order, once each', () => {
    const template = SqlTemplate.parse('select * from t where a = :a and b = :b or c = :a');
    expect(template.paramNames).toEqual(['a', 'b']);
  });

  it('ignores casts, string literals, quoted identifiers, comments and dollar-quoted bodies', () => {
    const sql = [
      "select ':in_string', \"col:name\", x::uuid, :real -- :comment",
      '/* :block */ , $$ :body $$, $tag$ :tagged $tag$',
    ].join('\n');
    expect(SqlTemplate.parse(sql).paramNames).toEqual(['real']);
  });

  it('keeps the original text when segments are joined back', () => {
    const sql = "insert into t (a, b) values (:a, 'x:y')";
    const text = SqlTemplate.parse(sql)
      .segments.map((segment) => (segment.kind === 'text' ? segment.value : `:${segment.name}`))
      .join('');
    expect(text).toBe(sql);
  });
});
