/**
 * Local entry point of Lumi, for `npm run dev -w @lumia/agent` and the sandbox services (`npm run dev:up`).
 *
 * It loads the repository `.env` when present (variables already set win), verifies the development tokens that
 * the sandbox login issues, and keeps conversations and preferences in directories; relative directories are
 * resolved from the repository root.
 */
import { existsSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLumiEnv } from '@lumia/packages/lumi-env';
import type { LumiEnv } from '@lumia/packages/lumi-env';
import { DevTokenVerifier } from '../identity/dev-token-verifier.ts';
import { LumiRuntime } from '../lumi-runtime.ts';
import { JsonLogger } from '../shared/logger.ts';

const appRoot = fileURLToPath(new URL('../../', import.meta.url));
const repoRoot = resolve(appRoot, '..', '..');

function inRepo(dir: string): string {
  return isAbsolute(dir) ? dir : resolve(repoRoot, dir);
}

function localPaths(env: LumiEnv): LumiEnv {
  return {
    ...env,
    session: env.session.kind === 'directory' ? { kind: 'directory', dir: inRepo(env.session.dir) } : env.session,
    memory: env.memory.kind === 'directory' ? { kind: 'directory', dir: inRepo(env.memory.dir) } : env.memory,
  };
}

async function main(): Promise<void> {
  const envFile = join(repoRoot, '.env');
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
  const env = localPaths(parseLumiEnv(process.env));
  if (env.devJwtSecret === null) {
    throw new Error('LUMIA_DEV_JWT_SECRET is required to verify the tokens of the sandbox (npm run sandbox:up creates it in .env).');
  }
  const logger = new JsonLogger(env.logLevel, { service: 'lumi' });
  const runtime = await LumiRuntime.start({ env, appRoot, identity: new DevTokenVerifier(env.devJwtSecret.reveal()), logger });
  runtime.stopOnSignals();
}

main().catch((error: unknown) => {
  new JsonLogger('error', { service: 'lumi' }).error('Lumi failed to start', { error });
  process.exitCode = 1;
});
