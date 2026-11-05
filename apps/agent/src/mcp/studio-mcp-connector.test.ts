import { describe, expect, it } from 'vitest';
import { SdkErrorCode, SdkHttpError } from '@modelcontextprotocol/client';
import { tool } from '@strands-agents/sdk';
import type { JSONValue, McpClientConfig, Tool } from '@strands-agents/sdk';
import { UnauthenticatedError } from '../identity/caller.ts';
import { JsonLogger } from '../shared/logger.ts';
import type { McpConnection } from './studio-mcp-connector.ts';
import { StudioMcpConnector, StudioUnavailableError } from './studio-mcp-connector.ts';

const quiet = new JsonLogger('error', {}, () => undefined);

function named(name: string): Tool {
  return tool({ name, description: name, callback: () => null });
}

function text(value: unknown): JSONValue {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}

class FakeConnection implements McpConnection {
  public config: McpClientConfig | undefined;
  public calls: string[] = [];
  public disconnected = 0;

  public constructor(
    private readonly tools: readonly string[],
    private readonly access: JSONValue | Error,
    private readonly listing: Error | null = null,
  ) {}

  public listTools(): Promise<Tool[]> {
    return this.listing === null ? Promise.resolve(this.tools.map(named)) : Promise.reject(this.listing);
  }

  public callTool(name: string): Promise<JSONValue> {
    this.calls.push(name);
    return this.access instanceof Error ? Promise.reject(this.access) : Promise.resolve(this.access);
  }

  public disconnect(): Promise<void> {
    this.disconnected += 1;
    return Promise.resolve();
  }
}

const LISTED = ['studio-read___get_my_access', 'studio-read___get_class', 'studio-slides___add_slides', 'studio-slides___delete_slide', 'knowledge___Retrieve', 'other___tool'];

function connector(connection: FakeConnection): StudioMcpConnector {
  return new StudioMcpConnector({ url: 'http://localhost:4100/mcp', tokenHeader: 'X-Studio-Token', openTargets: ['knowledge'], logger: quiet }, (config) => {
    connection.config = config;
    return connection;
  });
}

describe('StudioMcpConnector', () => {
  it('sends the token to the gateway and to the tools, and shows only the tools of the person', async () => {
    const connection = new FakeConnection(LISTED, text({ tools: ['studio-read___get_my_access', 'studio-read___get_class', 'studio-slides___add_slides'] }));
    const set = await connector(connection).connect('person-token');
    expect(connection.config).toMatchObject({ url: 'http://localhost:4100/mcp', headers: { Authorization: 'Bearer person-token', 'X-Studio-Token': 'person-token' } });
    expect(set.tools.map((item) => item.name)).toEqual(['studio-read___get_my_access', 'studio-read___get_class', 'studio-slides___add_slides', 'knowledge___Retrieve']);
    await set.close();
    expect(connection.disconnected).toBe(1);
  });

  it('hides every Studio tool when the person may not even read', async () => {
    const connection = new FakeConnection(LISTED, text({ error: { code: 'forbidden', message: 'Permisos insuficientes' } }));
    const set = await connector(connection).connect('token');
    expect(set.tools.map((item) => item.name)).toEqual(['knowledge___Retrieve']);
  });

  it('hides every Studio tool when the MCP does not list get_my_access', async () => {
    const connection = new FakeConnection(['studio-read___get_class'], text({ tools: [] }));
    const set = await connector(connection).connect('token');
    expect(set.tools).toEqual([]);
    expect(connection.calls).toEqual([]);
  });

  it('reports a token that Studio rejects as unauthenticated and closes the connection', async () => {
    const connection = new FakeConnection(LISTED, text({ error: { code: 'unauthenticated', message: 'expired' } }));
    await expect(connector(connection).connect('token')).rejects.toBeInstanceOf(UnauthenticatedError);
    expect(connection.disconnected).toBe(1);
  });

  it('reports a 401 of the gateway as unauthenticated', async () => {
    const rejected = new SdkHttpError(SdkErrorCode.ClientHttpAuthentication, 'Unauthorized', { status: 401 });
    const connection = new FakeConnection(LISTED, text({}), new Error('connect failed', { cause: rejected }));
    await expect(connector(connection).connect('token')).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it('reports any other failure as unavailable', async () => {
    await expect(connector(new FakeConnection(LISTED, text({}), new Error('ECONNREFUSED'))).connect('token')).rejects.toBeInstanceOf(StudioUnavailableError);
    await expect(connector(new FakeConnection(LISTED, text({ error: { code: 'unavailable', message: 'down' } }))).connect('token')).rejects.toBeInstanceOf(StudioUnavailableError);
    await expect(connector(new FakeConnection(LISTED, new Error('timeout'))).connect('token')).rejects.toBeInstanceOf(StudioUnavailableError);
  });
});
