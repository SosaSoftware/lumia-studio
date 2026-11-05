import { Config, ProcessEnvSource, loadEnvFileIfPresent } from '@lumia/api/config';
import { Logger } from '@lumia/api/log';
import { DevJwtVerifier } from '../auth/index.ts';
import { McpGatewayEmulator } from './mcp-gateway-emulator.ts';

// Local stand-in for the AgentCore Gateway of Lumi (`npm run dev:up` starts it as the `mcp` service).
loadEnvFileIfPresent(new URL('../../../.env', import.meta.url));

const logger = new Logger({ service: 'mcp-gateway' });
const config = new Config(new ProcessEnvSource());
const apiPort = config.integer('LUMIA_API_PORT', 4000);
const gateway = new McpGatewayEmulator({
  graphqlUrl: () => `http://localhost:${String(apiPort)}/graphql`,
  verifier: DevJwtVerifier.fromConfig(config),
  logger,
});
const port = await gateway.listen(config.integer('LUMIA_MCP_PORT', 4100));
logger.info('MCP gateway emulator listening', { port, path: '/mcp' });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    gateway.close().then(
      () => process.exit(0),
      (error: unknown) => {
        logger.error('Shutdown failed', { error });
        process.exit(1);
      },
    );
  });
}
