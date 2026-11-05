import { SdkHttpError, UnauthorizedError } from '@modelcontextprotocol/client';
import { McpClient } from '@strands-agents/sdk';
import type { JSONValue, McpClientConfig, Tool } from '@strands-agents/sdk';
import { UnauthenticatedError } from '../identity/caller.ts';
import type { Logger } from '../shared/logger.ts';
import { ACCESS_TOOL, StudioAccess } from './studio-access.ts';

/** The tools of the Studio MCP for one person, and the connection behind them. */
export interface StudioToolSet {
  readonly tools: readonly Tool[];
  close(): Promise<void>;
}

/** Opens the Studio MCP for one person. */
export interface StudioToolSource {
  /**
   * @param token - Bearer token of the person.
   * @throws UnauthenticatedError when the gateway or Studio reject the token.
   * @throws StudioUnavailableError when the MCP cannot be reached or answers unexpectedly.
   */
  connect(token: string): Promise<StudioToolSet>;
}

/** Raised when the Studio MCP cannot be reached or does not answer as expected. */
export class StudioUnavailableError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'StudioUnavailableError';
  }
}

/** One open MCP connection, as the connector uses it. */
export interface McpConnection {
  /** Tools of the server, ready for an agent. */
  listTools(): Promise<Tool[]>;
  /** Calls a listed tool directly, outside the agent loop; answers the raw MCP result. */
  callTool(name: string, args: JSONValue, timeoutMs: number): Promise<JSONValue>;
  disconnect(): Promise<void>;
}

/** {@link McpConnection} over the Strands `McpClient`. */
export class McpClientConnection implements McpConnection {
  private listed: Awaited<ReturnType<McpClient['listTools']>> = [];

  public constructor(private readonly client: McpClient) {}

  public async listTools(): Promise<Tool[]> {
    this.listed = await this.client.listTools();
    return [...this.listed];
  }

  public callTool(name: string, args: JSONValue, timeoutMs: number): Promise<JSONValue> {
    const tool = this.listed.find((candidate) => candidate.name === name);
    if (tool === undefined) {
      return Promise.reject(new StudioUnavailableError(`The MCP does not list ${name}.`));
    }
    return this.client.callTool(tool, args, { timeoutMs });
  }

  public disconnect(): Promise<void> {
    return this.client.disconnect();
  }
}

export interface StudioMcpOptions {
  /** URL of the MCP endpoint: AgentCore Gateway in AWS, the sandbox emulator locally. */
  readonly url: string;
  /** Header that the gateway propagates to the tools with the token of the person. */
  readonly tokenHeader: string;
  /** Targets whose tools every person sees, such as the knowledge base. */
  readonly openTargets: readonly string[];
  readonly logger: Logger;
}

/** Studio tools answer within the 28 s of their GraphQL client; the margin covers the gateway. */
const ACCESS_TIMEOUT_MS = 35_000;

/**
 * Connects to the Studio MCP through AgentCore Gateway with the token of the person.
 *
 * The token goes in `Authorization`, which the gateway authorizer validates, and in the propagated header that
 * carries it to the tool Lambdas, so Studio applies that person's permissions. The model never sees it. The
 * connector then asks `get_my_access` which Studio tools the person may use and hides the rest; Studio still
 * authorizes every call.
 */
export class StudioMcpConnector implements StudioToolSource {
  public constructor(
    private readonly options: StudioMcpOptions,
    private readonly openConnection: (config: McpClientConfig) => McpConnection = (config) => new McpClientConnection(new McpClient(config)),
  ) {}

  public async connect(token: string): Promise<StudioToolSet> {
    const connection = this.openConnection({
      url: this.options.url,
      headers: { Authorization: `Bearer ${token}`, [this.options.tokenHeader]: token },
      applicationName: 'lumi',
    });
    try {
      const listed = await connection.listTools();
      const access = await this.readAccess(connection, listed);
      const tools = listed.filter((tool) => access.allows(tool.name, this.options.openTargets));
      this.options.logger.debug('Studio MCP connected', { listed: listed.length, visible: tools.length });
      return { tools, close: () => connection.disconnect() };
    } catch (error) {
      await this.disconnect(connection);
      throw StudioMcpConnector.classify(error);
    }
  }

  private async readAccess(connection: McpConnection, listed: readonly Tool[]): Promise<StudioAccess> {
    if (!listed.some((tool) => tool.name === ACCESS_TOOL)) {
      this.options.logger.warn('The Studio MCP does not list get_my_access; Studio tools stay hidden', { tool: ACCESS_TOOL });
      return StudioAccess.none();
    }
    const outcome = StudioAccess.fromToolResult(await connection.callTool(ACCESS_TOOL, {}, ACCESS_TIMEOUT_MS));
    if (outcome.kind === 'granted') {
      return outcome.access;
    }
    if (outcome.code === 'unauthenticated') {
      throw new UnauthenticatedError('Studio rejected the token of the person.');
    }
    if (outcome.code === 'forbidden') {
      // The person may not even read: Lumi can still talk, without Studio tools.
      return StudioAccess.none();
    }
    throw new StudioUnavailableError(`get_my_access failed (${outcome.code}).`);
  }

  private async disconnect(connection: McpConnection): Promise<void> {
    try {
      await connection.disconnect();
    } catch (error) {
      this.options.logger.warn('Closing the Studio MCP connection failed', { error });
    }
  }

  private static classify(error: unknown): Error {
    if (error instanceof UnauthenticatedError || error instanceof StudioUnavailableError) {
      return error;
    }
    for (let current: unknown = error; current instanceof Error; current = current.cause) {
      if (current instanceof UnauthorizedError || (current instanceof SdkHttpError && current.status === 401)) {
        return new UnauthenticatedError('The gateway rejected the token of the person.', { cause: error });
      }
    }
    return new StudioUnavailableError('The Studio MCP is not available.', { cause: error });
  }
}
