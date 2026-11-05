import { existsSync } from 'node:fs';

/** Loads a local `.env` into `process.env` when the file exists. Existing variables are kept. */
export function loadEnvFileIfPresent(file: URL | string): void {
  if (existsSync(file)) {
    process.loadEnvFile(file);
  }
}
