import { Config, ProcessEnvSource } from '@lumia/api/config';
import { Logger } from '@lumia/api/log';
import { DevJwtVerifier } from '../auth/index.ts';
import { SandboxServer } from '../sandbox-server.ts';
import { MCP_PATH, McpGatewayEmulator } from './mcp-gateway-emulator.ts';

/**
 * A local Studio for tests of Lumi: the sandbox API and the gateway emulator, in-process on free ports, against the
 * sandbox Postgres (`npm run sandbox:init`). Lumi's tests reach Studio only through these URLs, as Lumi does.
 */
export class LocalStudio {
  private constructor(
    private readonly api: SandboxServer,
    private readonly gateway: McpGatewayEmulator,
    /** Base URL of the sandbox API (GraphQL at `/graphql`, development login at `/dev/login`). */
    public readonly apiUrl: string,
    /** URL of the MCP endpoint of the gateway emulator. */
    public readonly mcpUrl: string,
  ) {}

  /** Starts both servers with the settings of the environment (the repository `.env`). */
  public static async start(): Promise<LocalStudio> {
    const config = new Config(new ProcessEnvSource());
    const logger = new Logger({ service: 'local-studio' }, { write: () => undefined });
    const api = await SandboxServer.create(config, logger);
    const apiUrl = `http://localhost:${String(await api.listen(0))}`;
    const gateway = new McpGatewayEmulator({ graphqlUrl: () => `${apiUrl}/graphql`, verifier: DevJwtVerifier.fromConfig(config), logger });
    const mcpUrl = `http://localhost:${String(await gateway.listen(0))}${MCP_PATH}`;
    return new LocalStudio(api, gateway, apiUrl, mcpUrl);
  }

  /** Development token of a seeded account. */
  public async login(email: string): Promise<string> {
    const response = await fetch(`${this.apiUrl}/dev/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
    const body: unknown = await response.json();
    const token = typeof body === 'object' && body !== null && 'token' in body ? body.token : undefined;
    if (!response.ok || typeof token !== 'string') {
      throw new Error(`The sandbox login refused ${email} (HTTP ${String(response.status)}).`);
    }
    return token;
  }

  public async close(): Promise<void> {
    await this.gateway.close();
    await this.api.close();
  }
}
