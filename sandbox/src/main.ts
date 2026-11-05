import { Config, loadEnvFileIfPresent, ProcessEnvSource } from '@lumia/api/config';
import { Logger } from '@lumia/api/log';
import { SandboxServer } from './sandbox-server.ts';

loadEnvFileIfPresent(new URL('../../.env', import.meta.url));

const logger = new Logger({ service: 'sandbox' });
const config = new Config(new ProcessEnvSource());
const server = await SandboxServer.create(config, logger);
const port = await server.listen(config.integer('LUMIA_API_PORT', 4000));
logger.info('Sandbox API listening', { port });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close().then(
      () => process.exit(0),
      (error: unknown) => {
        logger.error('Shutdown failed', { error });
        process.exit(1);
      },
    );
  });
}
