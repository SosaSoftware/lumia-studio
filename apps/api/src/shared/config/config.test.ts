import { describe, expect, it } from 'vitest';
import { Config, ConfigError, ProcessEnvSource } from './index.ts';
import type { ConfigSource } from './index.ts';

class MapSource implements ConfigSource {
  public constructor(private readonly values: Record<string, string>) {}

  public get(name: string): string | undefined {
    return this.values[name];
  }
}

describe('Config', () => {
  it('returns a present required value', () => {
    expect(new Config(new MapSource({ A: 'x' })).required('A')).toBe('x');
  });

  it('throws ConfigError naming the variable when required is absent or empty', () => {
    const config = new Config(new MapSource({ EMPTY: '' }));
    expect(() => config.required('MISSING')).toThrow(ConfigError);
    expect(() => config.required('MISSING')).toThrow(/MISSING/);
    expect(() => config.required('EMPTY')).toThrow(/EMPTY/);
  });

  it('returns the fallback for an absent optional value', () => {
    const config = new Config(new MapSource({ SET: 'v' }));
    expect(config.optional('NOPE', 'dflt')).toBe('dflt');
    expect(config.optional('SET', 'dflt')).toBe('v');
  });

  it('parses integers and applies the fallback', () => {
    const config = new Config(new MapSource({ N: '42' }));
    expect(config.integer('N')).toBe(42);
    expect(config.integer('NOPE', 7)).toBe(7);
  });

  it('throws ConfigError for an invalid or missing integer without fallback', () => {
    const config = new Config(new MapSource({ BAD: '4.5x' }));
    expect(() => config.integer('BAD')).toThrow(ConfigError);
    expect(() => config.integer('NOPE')).toThrow(ConfigError);
  });
});

describe('ProcessEnvSource', () => {
  it('reads from process.env', () => {
    process.env.LUMIA_TEST_VAR = 'ok';
    expect(new ProcessEnvSource().get('LUMIA_TEST_VAR')).toBe('ok');
    delete process.env.LUMIA_TEST_VAR;
  });
});
