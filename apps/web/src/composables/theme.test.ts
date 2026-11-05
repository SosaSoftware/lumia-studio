import { describe, expect, it } from 'vitest';
import { LANG_KEY, isLangAvailable, readLang } from './theme.ts';

function storageWith(value: string | null): Storage {
  const values = new Map<string, string>(value === null ? [] : [[LANG_KEY, value]]);
  return {
    length: values.size,
    clear: () => {
      values.clear();
    },
    getItem: (key) => values.get(key) ?? null,
    key: () => null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, item) => {
      values.set(key, item);
    },
  };
}

describe('language', () => {
  it('shows Spanish while English is disabled, even when English was chosen before', () => {
    expect(isLangAvailable('es')).toBe(true);
    expect(isLangAvailable('en')).toBe(false);
    expect(readLang(storageWith('en'))).toBe('es');
    expect(readLang(storageWith(null))).toBe('es');
  });
});
