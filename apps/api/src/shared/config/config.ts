import { ConfigError } from './config-error.ts';
import type { ConfigSource } from './config-source.ts';

/** Typed access to configuration values read from an injected source. */
export class Config {
  public constructor(private readonly source: ConfigSource) {}

  public required(name: string): string {
    const value = this.source.get(name);
    if (value === undefined || value === '') {
      throw new ConfigError(name, 'required value is missing or empty');
    }
    return value;
  }

  public optional(name: string, fallback: string): string {
    const value = this.source.get(name);
    return value === undefined || value === '' ? fallback : value;
  }

  public integer(name: string, fallback?: number): number {
    const raw = this.source.get(name);
    if (raw === undefined || raw === '') {
      if (fallback === undefined) {
        throw new ConfigError(name, 'required integer is missing or empty');
      }
      return fallback;
    }
    if (!/^-?\d+$/.test(raw.trim())) {
      throw new ConfigError(name, `"${raw}" is not an integer`);
    }
    return Number.parseInt(raw, 10);
  }
}
