import { describe, expect, it } from 'vitest';
import { LANG_KEY, readLang } from '../i18n/index.ts';

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
  it('restores the stored language and falls back to Spanish', () => {
    expect(readLang(storageWith('en'))).toBe('en');
    expect(readLang(storageWith('es'))).toBe('es');
    expect(readLang(storageWith('fr'))).toBe('es');
    expect(readLang(storageWith(null))).toBe('es');
  });
});
