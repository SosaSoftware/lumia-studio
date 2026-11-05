import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, Server as HttpServer, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { Server, createMcpHandler } from '@modelcontextprotocol/server';
import type { CallToolResult, McpHttpHandler } from '@modelcontextprotocol/server';
import type { Logger } from '@lumia/api/log';
import { MCP_TARGETS, STUDIO_TOKEN_ARGUMENT, STUDIO_TOKEN_HEADER, createToolHandler, toolSchemas } from '@lumia/api/mcp';
import type { GatewayToolHandler, McpTarget } from '@lumia/api/mcp';
import type { TokenVerifier } from '../auth/index.ts';

export const MCP_PATH = '/mcp';
const HEALTH_PATH = '/health';
const TOOL_NAME_DELIMITER = '___';
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const GATEWAY_ID = 'sandbox-gateway';

export interface McpGatewayEmulatorOptions {
  /** GraphQL endpoint of the sandbox API, which the tools call with the token of the person. */
  readonly graphqlUrl: () => string;
  /** Verifies the inbound token, as the JWT authorizer of the gateway does. */
  readonly verifier: TokenVerifier;
  readonly logger: Logger;
}

interface Route {
  readonly target: McpTarget;
  readonly handler: GatewayToolHandler;
}

/** Records only, as Lambda receives them after JSON decoding. */
function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {};
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new RangeError('Request body too large');
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

/**
 * Local stand-in for the AgentCore Gateway of Lumi, in front of the Studio MCP tool handlers.
 *
 * It serves MCP over Streamable HTTP at `/mcp` and behaves like the gateway with Lambda targets:
 * - the inbound token is verified (the sandbox development JWT in place of Cognito);
 * - tools are listed as `<target>___<tool>` with the inline schemas of each target;
 * - a call runs the same handler as the target Lambda, with the tool name in `clientContext.custom` and the
 *   allowed request header (the token of the person) in `bedrockAgentCorePropagatedHeaders`;
 * - like the interceptor of the gateway, a `_studio_token` sent as an argument is removed;
 * - the JSON that the handler answers becomes the text content of the MCP result.
 */
export class McpGatewayEmulator {
  private readonly routes: ReadonlyMap<string, Route>;
  private readonly mcp: McpHttpHandler;
  private server: HttpServer | undefined;

  public constructor(private readonly options: McpGatewayEmulatorOptions) {
    const targets = Object.values(MCP_TARGETS);
    this.routes = new Map(
      targets.map((target) => [target.name, { target, handler: createToolHandler(target, { graphqlUrl: options.graphqlUrl, logger: options.logger, targets }) }]),
    );
    this.mcp = createMcpHandler(({ requestInfo }) => this.mcpServer(requestInfo?.headers.get(STUDIO_TOKEN_HEADER) ?? null), {
      onerror: (error) => {
        options.logger.warn('MCP request failed', { error: error.message });
      },
    });
  }

  /** Starts listening; returns the bound port (useful with port 0). */
  public listen(port: number): Promise<number> {
    const server = createServer((req, res) => {
      this.dispatch(req, res).catch((error: unknown) => {
        this.options.logger.error('Unhandled gateway failure', { error });
        if (!res.headersSent) {
          res.writeHead(500, { 'content-type': 'application/json' });
        }
        res.end(JSON.stringify({ message: 'Gateway error.' }));
      });
    });
    this.server = server;
    return new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, () => {
        const address = server.address();
        resolve(typeof address === 'object' && address !== null ? address.port : port);
      });
    });
  }

  public async close(): Promise<void> {
    await this.mcp.close();
    const server = this.server;
    this.server = undefined;
    if (server !== undefined) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error === undefined) resolve();
          else reject(error);
        });
        server.closeAllConnections();
      });
    }
  }

  private async dispatch(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === HEALTH_PATH && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ status: 'ok' }));
      return;
    }
    if (url.pathname !== MCP_PATH) {
      res.writeHead(404, { 'content-type': 'application/json' }).end(JSON.stringify({ message: 'Route not found.' }));
      return;
    }
    const token = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '')?.[1];
    try {
      if (token === undefined) throw new Error('missing bearer token');
      await this.options.verifier.verify(token);
    } catch {
      // Same answer as the gateway authorizer: no detail about why the token was refused.
      res.writeHead(401, { 'content-type': 'application/json', 'www-authenticate': 'Bearer' }).end(JSON.stringify({ message: 'Unauthorized' }));
      return;
    }
    const body = req.method === 'POST' ? await readBody(req) : undefined;
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers.set(name, value);
      else if (Array.isArray(value)) headers.set(name, value.join(', '));
    }
    const response = await this.mcp.fetch(new Request(url, { method: req.method ?? 'GET', headers, ...(body === undefined ? {} : { body }) }));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body === null) {
      res.end();
      return;
    }
    // The DOM and Node typings of ReadableStream differ only in their declarations; the runtime object is the same.
    Readable.fromWeb(response.body as WebReadableStream<Uint8Array>).pipe(res);
  }

  /** The MCP server of one request; the propagated header is the one this request carried. */
  private mcpServer(propagatedToken: string | null): Server {
    const server = new Server({ name: 'lumia-studio-mcp-gateway', version: '1.0.0' }, { capabilities: { tools: {} } });
    server.setRequestHandler('tools/list', () => ({
      tools: [...this.routes.values()].flatMap(({ target }) =>
        toolSchemas(target).map((schema) => ({ name: `${target.name}${TOOL_NAME_DELIMITER}${schema.name}`, description: schema.description, inputSchema: schema.inputSchema })),
      ),
    }));
    server.setRequestHandler('tools/call', async (request): Promise<CallToolResult> => {
      const name = request.params.name;
      const route = this.routes.get(name.slice(0, Math.max(0, name.indexOf(TOOL_NAME_DELIMITER))));
      if (route === undefined) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: { code: 'unknown_tool', message: `Unknown tool ${name}.` } }) }], isError: true };
      }
      const { [STUDIO_TOKEN_ARGUMENT]: _dropped, ...args } = record(request.params.arguments);
      const custom = {
        bedrockAgentCoreMessageVersion: '1.0',
        bedrockAgentCoreAwsRequestId: randomUUID(),
        bedrockAgentCoreMcpMessageId: randomUUID(),
        bedrockAgentCoreGatewayId: GATEWAY_ID,
        bedrockAgentCoreTargetId: route.target.name,
        bedrockAgentCoreToolName: name,
        bedrockAgentCorePropagatedHeaders: propagatedToken === null ? {} : { [STUDIO_TOKEN_HEADER]: propagatedToken },
      };
      const result = await route.handler(args, { clientContext: { custom } });
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    });
    return server;
  }
}
