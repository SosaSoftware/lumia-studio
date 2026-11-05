import { describe, expect, it } from 'vitest';
import { InputReader } from './input-reader.ts';

describe('InputReader', () => {
  const reader = new InputReader({ name: 'a', n: 2, nested: { id: 'x' }, props: '{"a":1}', bad: '{', ids: ['nope'] });

  it('reads typed values', () => {
    expect(reader.string('name')).toBe('a');
    expect(reader.optionalNumber('missing')).toBeUndefined();
    expect(reader.object('nested').string('id')).toBe('x');
  });

  it('names the field in validation errors', () => {
    expect(() => reader.string('n')).toThrow(/^n: /);
    expect(() => reader.object('nested').number('id')).toThrow(/^nested\.id: /);
    expect(() => reader.json('bad')).toThrow(/^bad: /);
    expect(() => reader.ids('ids')).toThrow(/ids\[0\]/);
  });

  it('parses AWSJSON strings and passes parsed values through', () => {
    expect(reader.json('props')).toEqual({ a: 1 });
    expect(new InputReader({ props: { b: 2 } }).json('props')).toEqual({ b: 2 });
  });
});
