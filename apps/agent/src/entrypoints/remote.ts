/**
 * Entry point of Lumi in Amazon Bedrock AgentCore Runtime, bundled as `dist/remote.mjs` (`npm run build`).
 *
 * The runtime's inbound JWT authorizer validates the Cognito token of every request before it reaches this
 * process, and the runtime must forward the `Authorization` header to the container. Settings come only from the
 * environment of the runtime; the image sets `LUMI_BIND_HOST=0.0.0.0` and `LUMI_PORT=8080`.
 */
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLumiEnv } from '@lumia/packages/lumi-env';
import { AgentCoreTokenReader } from '../identity/agentcore-token-reader.ts';
import { LumiRuntime } from '../lumi-runtime.ts';
import { JsonLogger } from '../shared/logger.ts';

/** Root of the package, from the bundle (`dist/remote.mjs`) or from the source (`src/entrypoints/remote.ts`). */
function packageRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return basename(here) === 'dist' ? resolve(here, '..') : resolve(here, '..', '..');
}

async function main(): Promise<void> {
  const env = parseLumiEnv(process.env);
  const logger = new JsonLogger(env.logLevel, { service: 'lumi' });
  const runtime = await LumiRuntime.start({ env, appRoot: packageRoot(), identity: new AgentCoreTokenReader(), logger });
  runtime.stopOnSignals();
}

main().catch((error: unknown) => {
  new JsonLogger('error', { service: 'lumi' }).error('Lumi failed to start', { error });
  process.exitCode = 1;
});
