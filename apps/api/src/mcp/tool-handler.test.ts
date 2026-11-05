import { describe, expect, it } from 'vitest';
import { Logger } from '../shared/log/index.ts';
import { record, text } from './decode.ts';
import { STUDIO_TOKEN_HEADER } from './gateway-invocation.ts';
import type { FetchFunction } from './studio-graphql.ts';
import { MCP_TARGETS } from './targets.ts';
import type { McpTarget } from './targets.ts';
import { createToolHandler } from './tool-handler.ts';

const URL = 'https://studio.test/graphql';
const quiet = new Logger({}, { write: () => undefined });

interface Call {
  readonly url: string;
  readonly authorization: string;
  readonly query: string;
  readonly variables: Record<string, unknown>;
}

/** A Studio that answers each request with the first scripted answer whose key appears in the query. */
function scriptedStudio(answers: readonly (readonly [string, unknown, number?])[]): { fetch: FetchFunction; calls: Call[] } {
  const calls: Call[] = [];
  const fetchFn: FetchFunction = (url, init) => {
    const body = record(JSON.parse(typeof init.body === 'string' ? init.body : '{}'));
    const query = text(body.query);
    calls.push({ url, authorization: new Headers(init.headers).get('authorization') ?? '', query, variables: record(body.variables) });
    const answer = answers.find(([key]) => query.includes(key));
    return Promise.resolve(new Response(JSON.stringify(answer?.[1] ?? { data: null }), { status: answer?.[2] ?? 200 }));
  };
  return { fetch: fetchFn, calls };
}

function invoke(target: McpTarget, fetchFn: FetchFunction, tool: string, args: unknown, token: string | null = 'person-token'): Promise<unknown> {
  const handler = createToolHandler(target, { graphqlUrl: () => URL, fetch: fetchFn, logger: quiet, targets: Object.values(MCP_TARGETS) });
  const headers = token === null ? {} : { [STUDIO_TOKEN_HEADER]: token };
  return handler(args, { clientContext: { custom: { bedrockAgentCoreToolName: `${target.name}___${tool}`, bedrockAgentCorePropagatedHeaders: headers } } });
}

const element = (id: string, slideId: string, title: string): Record<string, unknown> => ({
  id,
  slideId,
  component: 'title',
  name: 'Título',
  x: 10,
  y: 10,
  w: 80,
  h: 12,
  z: 1,
  appearsAtS: 0,
  entrance: 'none',
  props: JSON.stringify({ text: title, level: 'h1', align: 'left' }),
  mediaId: null,
  media: null,
});

const slide = (id: string, elementId: string, title: string): Record<string, unknown> => ({
  id,
  versionId: 'v',
  position: 1,
  type: 'cover',
  title: 'Portada',
  background: 'surface',
  durationS: 8,
  transition: 'none',
  advance: 'click',
  elements: [element(elementId, id, title)],
  narrationClips: [],
  pauses: [],
  audioClips: [],
  comments: [],
});

describe('Studio MCP tool handler', () => {
  it('answers unknown tools, missing tokens and invalid input as errors without calling Studio', async () => {
    const studio = scriptedStudio([]);
    expect(await invoke(MCP_TARGETS.read, studio.fetch, 'publish_class', {})).toMatchObject({ error: { code: 'unknown_tool' } });
    expect(await invoke(MCP_TARGETS.read, studio.fetch, 'get_class', { nodeId: 'n' }, null)).toMatchObject({ error: { code: 'unauthenticated' } });
    expect(await invoke(MCP_TARGETS.slides, studio.fetch, 'add_slides', { nodeId: 'n', slides: [] })).toMatchObject({ error: { code: 'invalid_input' } });
    expect(await invoke(MCP_TARGETS.elements, studio.fetch, 'add_element', { nodeId: 'n', slideId: 's', component: 'title', props: { level: 'h9' } })).toMatchObject({
      error: { code: 'invalid_input', message: expect.stringContaining('title: props.level') as string },
    });
    expect(studio.calls).toEqual([]);
  });

  it('calls Studio with the bare token of the person and tells a missing permission as "Permisos insuficientes"', async () => {
    const studio = scriptedStudio([['me', { data: null, errors: [{ errorType: 'Unauthorized', message: 'No tienes permiso para realizar esta acción.' }] }]]);
    expect(await invoke(MCP_TARGETS.read, studio.fetch, 'get_my_access', {}, 'Bearer person-token')).toEqual({
      error: { code: 'forbidden', message: 'Permisos insuficientes: no tienes permiso para realizar esta acción.' },
    });
    expect(studio.calls[0]).toMatchObject({ url: URL, authorization: 'person-token' });
    const expired = scriptedStudio([['me', { errors: [{ errorType: 'UnauthorizedException', message: 'Valid authorization header not provided.' }] }, 401]]);
    expect(await invoke(MCP_TARGETS.read, expired.fetch, 'get_my_access', {})).toMatchObject({ error: { code: 'unauthenticated' } });
  });

  it('lists the tools the role allows, with the names the model sees', async () => {
    const studio = scriptedStudio([['me', { data: { me: { name: 'Lucía', email: 'l@studio.test', role: 'viewer', roleName: 'Lectura', actions: ['documents.view'] } } }]]);
    const answer = await invoke(MCP_TARGETS.read, studio.fetch, 'get_my_access', {});
    expect(answer).toMatchObject({ actions: ['documents.view'], tools: MCP_TARGETS.read.tools.map((tool) => `studio-read___${tool.name}`) });
  });

  it('creates the draft of a published class, moves to the new ids and merges the props', async () => {
    const published = { id: 'v1', documentId: 'd', number: 1, status: 'published', slides: [slide('s1', 'e1', 'Hola')] };
    const draft = { id: 'v2', documentId: 'd', number: 2, status: 'draft', slides: [slide('s2', 'e2', 'Hola')] };
    const studio = scriptedStudio([
      ['document(nodeId', { data: { document: { id: 'd', nodeId: 'n', status: 'published', currentVersion: 1, publishedVersion: 1, editingVersion: published } } }],
      ['createVersion', { data: { createVersion: draft } }],
      ['saveElement', { data: { saveElement: element('e2', 's2', 'Adiós') } }],
    ]);
    const answer = await invoke(MCP_TARGETS.elements, studio.fetch, 'update_element', { nodeId: 'n', elementId: 'e1', props: { text: 'Adiós' } });
    expect(answer).toMatchObject({ element: { id: 'e2', props: { text: 'Adiós', level: 'h1' } }, slideId: 's2', draft: { versionNumber: 2, idMap: { s1: 's2', e1: 'e2' } } });
    const save = studio.calls.find((call) => call.query.includes('saveElement'));
    expect(save?.variables.i).toMatchObject({ id: 'e2', slideId: 's2', component: 'title' });
    expect(JSON.parse(text(record(save?.variables.i).props))).toEqual({ text: 'Adiós', level: 'h1', align: 'left' });
  });
});
