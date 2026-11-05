import type { ConfigSource } from './config-source.ts';

/** Reads configuration values from process environment variables. */
export class ProcessEnvSource implements ConfigSource {
  public get(name: string): string | undefined {
    return process.env[name];
  }
}
