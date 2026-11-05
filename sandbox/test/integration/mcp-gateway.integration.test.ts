import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Config, ProcessEnvSource } from '@lumia/api/config';
import { Logger } from '@lumia/api/log';
import { MCP_TARGETS, STUDIO_TOKEN_HEADER } from '@lumia/api/mcp';
import { DevJwtVerifier } from '../../src/auth/index.ts';
import { MCP_PATH, McpGatewayEmulator } from '../../src/mcp-gateway/index.ts';
import { SandboxServer } from '../../src/sandbox-server.ts';

// The gateway emulator in front of the sandbox API, called as Lumi calls AgentCore Gateway. Uses the seeded
// demo accounts and only reads.
const quiet = new Logger({}, { write: () => undefined });
let api: SandboxServer;
let gateway: McpGatewayEmulator;
let apiBase: string;
let mcpUrl: string;
const tokens = { creator: '', viewer: '' };

type Json = Record<string, unknown>;

function json(value: unknown): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`Expected an object, got ${JSON.stringify(value)}`);
  return Object.fromEntries(Object.entries(value));
}

async function tokenOf(email: string): Promise<string> {
  const response = await fetch(`${apiBase}/dev/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
  const token = json(await response.json()).token;
  if (typeof token !== 'string') throw new Error(`No token for ${email}`);
  return token;
}

/** One JSON-RPC request to the stateless MCP endpoint; the answer comes as JSON or as one SSE message. */
async function rpc(method: string, params: Json, headers: Record<string, string>): Promise<{ status: number; body: Json | null }> {
  const response = await fetch(mcpUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const text = await response.text();
  if (response.status !== 200) return { status: response.status, body: null };
  const payload = response.headers.get('content-type')?.includes('text/event-stream') === true ? (text.split('\n').find((line) => line.startsWith('data: '))?.slice(6) ?? '{}') : text;
  return { status: response.status, body: json(JSON.parse(payload)) };
}

function asPerson(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, [STUDIO_TOKEN_HEADER]: token };
}

async function callTool(name: string, args: Json, headers: Record<string, string>): Promise<Json> {
  const { body } = await rpc('tools/call', { name, arguments: args }, headers);
  const content = json(body?.result).content;
  const first = Array.isArray(content) ? json(content[0]) : {};
  return json(JSON.parse(String(first.text)));
}

beforeAll(async () => {
  const config = new Config(new ProcessEnvSource());
  api = await SandboxServer.create(config, quiet);
  apiBase = `http://localhost:${String(await api.listen(0))}`;
  gateway = new McpGatewayEmulator({ graphqlUrl: () => `${apiBase}/graphql`, verifier: DevJwtVerifier.fromConfig(config), logger: quiet });
  mcpUrl = `http://localhost:${String(await gateway.listen(0))}${MCP_PATH}`;
  tokens.creator = await tokenOf('creadora@studio.test');
  tokens.viewer = await tokenOf('lectora@studio.test');
});

afterAll(async () => {
  await gateway.close();
  await api.close();
});

describe('MCP gateway emulator', () => {
  it('rejects requests without a valid token, as the gateway authorizer', async () => {
    expect((await rpc('tools/list', {}, {})).status).toBe(401);
    expect((await rpc('tools/list', {}, { authorization: 'Bearer not-a-token' })).status).toBe(401);
  });

  it('lists every tool of every target as <target>___<tool>', async () => {
    const { body } = await rpc('tools/list', {}, asPerson(tokens.creator));
    const tools = json(body?.result).tools;
    const names = Array.isArray(tools) ? tools.map((tool) => String(json(tool).name)) : [];
    const expected = Object.values(MCP_TARGETS).flatMap((target) => target.tools.map((tool) => `${target.name}___${tool.name}`));
    expect(names.sort()).toEqual(expected.sort());
  });

  it('propagates the token header to the tools, so Studio answers with the permissions of the person', async () => {
    const creator = await callTool('studio-read___get_my_access', {}, asPerson(tokens.creator));
    const viewer = await callTool('studio-read___get_my_access', {}, asPerson(tokens.viewer));
    expect(creator.tools).toEqual(expect.arrayContaining(['studio-read___get_class', 'studio-slides___add_slides']));
    expect(viewer.tools).toEqual(expect.arrayContaining(['studio-read___get_class']));
    expect(viewer.tools).not.toContain('studio-slides___add_slides');
  });

  it('removes a token sent as an argument, so only the propagated header counts', async () => {
    const answer = await callTool('studio-read___get_my_access', { _studio_token: tokens.creator }, { authorization: `Bearer ${tokens.creator}` });
    expect(json(answer.error).code).toBe('unauthenticated');
  });
});
