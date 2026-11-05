import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Config, ProcessEnvSource } from '@lumia/api/config';
import { createDatabase } from '@lumia/api/db';
import type { CloseableDatabase } from '@lumia/api/db';
import { Logger } from '@lumia/api/log';
import { SandboxServer } from '../../src/sandbox-server.ts';

// Runs against the seeded sandbox (`npm run sandbox:init`).
let server: SandboxServer;
let base: string;
let admin: CloseableDatabase;
const uploadedKeys: string[] = [];

interface GraphqlAnswer {
  data?: Record<string, unknown> | null;
  errors?: { errorType: string; message: string }[];
}

async function login(email: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${base}/dev/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

async function tokenOf(email: string): Promise<string> {
  const { body } = await login(email);
  if (typeof body.token !== 'string') throw new Error(`No token for ${email}`);
  return body.token;
}

async function graphql(token: string, query: string, variables: Record<string, unknown> = {}): Promise<GraphqlAnswer> {
  const response = await fetch(`${base}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  });
  return (await response.json()) as GraphqlAnswer;
}

interface Category {
  id: string;
  displayName: string;
  groupName: string | null;
  subcategories: { id: string; name: string; groupName: string | null }[];
}

async function categories(token: string): Promise<Category[]> {
  const answer = await graphql(token, '{ categories { items { id displayName groupName subcategories { id name groupName } } } }');
  return (answer.data?.categories as { items: Category[] }).items;
}

beforeAll(async () => {
  const config = new Config(new ProcessEnvSource());
  server = await SandboxServer.create(config, new Logger({}, { write: () => undefined }));
  base = `http://localhost:${String(await server.listen(0))}`;
  admin = createDatabase('admin', config);
});

afterAll(async () => {
  for (const key of uploadedKeys) {
    await admin.execute('delete from studio.media_asset where s3_key = :key', { key });
  }
  await server.close();
  await admin.close();
});

describe('development login', () => {
  it('signs any active person with a role by email, without a password', async () => {
    const { status, body } = await login('  Creadora@studio.test ');
    expect(status).toBe(200);
    expect(body).toMatchObject({ expiresIn: 28800, claims: { email: 'creadora@studio.test', name: 'Carlos Sosa', studio_role: 'content_creator' } });
  });

  it('signs a token that only identifies the person; Studio reads the role from the database', async () => {
    const token = await tokenOf('creadora@studio.test');
    const payload: unknown = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString());
    expect(payload).toMatchObject({ sub: 'dev:creadora@studio.test', email: 'creadora@studio.test' });
    expect(payload).not.toHaveProperty('studio_actions');
    const me = await graphql(token, '{ me { name role actions } }');
    expect(me.data?.me).toMatchObject({ name: 'Carlos Sosa', role: 'content_creator', actions: expect.arrayContaining(['documents.edit']) as string[] });
  });

  it('answers 403 for an account without access and 401 for an unknown account', async () => {
    expect(await login('sin-acceso@studio.test')).toMatchObject({ status: 403, body: { reason: 'no_access', message: 'Tu cuenta no tiene acceso a Lumia Studio.' } });
    expect(await login('nadie@studio.test')).toMatchObject({ status: 401, body: { reason: 'unknown_user' } });
    expect((await login('')).status).toBe(400);
  });
});

describe('GraphQL API', () => {
  // People edit the sandbox while they test, so this checks the shape of the data, not the content of the showcase.
  it('serves the granted categories, the tree and the showcase document', async () => {
    const token = await tokenOf('creadora@studio.test');
    const [academy] = await categories(token);
    expect(academy?.displayName).toBe('Academia Lumia');
    expect(academy?.subcategories.map((subcategory) => subcategory.name)).toEqual(['inteligencia-artificial', 'matematicas']);
    expect(academy?.groupName).toBe('Academias');
    expect(academy?.subcategories.map((subcategory) => subcategory.groupName)).toEqual(['Lumia', 'CNB']);
    const ai = academy?.subcategories[0]?.id ?? '';
    const tree = await graphql(token, 'query($s: ID!) { treeNodes(filter: { subcategoryId: $s }) { items { id parentId kind name displayName documentStatus } } }', { s: ai });
    const nodes = (tree.data?.treeNodes as { items: { id: string; parentId: string | null; kind: string; name: string; documentStatus: string | null }[] }).items;
    const showcase = nodes.find((node) => node.name === 'que-es-la-ia.lumia');
    expect(showcase?.kind).toBe('class');
    expect(['draft', 'published']).toContain(showcase?.documentStatus);
    expect(nodes.find((node) => node.id === showcase?.parentId)?.name).toBe('fundamentos');
    const document = await graphql(token, 'query($n: ID!) { document(nodeId: $n) { nodeId editingVersion { slides { position elements { component } } } } }', { n: showcase?.id });
    const slides = (document.data?.document as { editingVersion: { slides: { elements: { component: string }[] }[] } }).editingVersion.slides;
    expect(slides.length).toBeGreaterThan(0);
    expect(slides.some((slide) => slide.elements.length > 0)).toBe(true);
  });

  it('exchanges AWSJSON as JSON text encoded once, like AppSync', async () => {
    const token = await tokenOf('creadora@studio.test');
    const answer = await graphql(token, '{ componentCatalog { components { key defaults } } }');
    const components = (answer.data?.componentCatalog as { components: { key: string; defaults: unknown }[] }).components;
    const title = components.find((component) => component.key === 'title');
    expect(typeof title?.defaults).toBe('string');
    expect(JSON.parse(String(title?.defaults))).toMatchObject({ text: expect.any(String) as string, level: 'h2' });
  });

  it('keeps each person inside the granted subcategories, with AppSync errors', async () => {
    const creator = await tokenOf('creadora@studio.test');
    const ai = (await categories(creator))[0]?.subcategories[0]?.id ?? '';
    const math = await tokenOf('matematicas@studio.test');
    expect((await categories(math)).map((category) => category.subcategories.map((subcategory) => subcategory.name))).toEqual([['matematicas']]);
    const denied = await graphql(math, 'query($s: ID!) { treeNodes(filter: { subcategoryId: $s }) { items { id } } }', { s: ai });
    expect(denied.errors?.[0]).toMatchObject({ errorType: 'Unauthorized', message: 'No tienes permiso para realizar esta acción.' });
    const invalid = await graphql('not-a-token', '{ categories { items { id } } }');
    expect(invalid.errors?.[0]?.errorType).toBe('Unauthorized');
  });

  it('uploads a file through the signed storage routes and registers it in the category library', async () => {
    const token = await tokenOf('creadora@studio.test');
    const categoryId = (await categories(token))[0]?.id ?? '';
    const input = { categoryId, name: 'prueba.png', mimeType: 'image/png', sizeBytes: 3 };
    const upload = (await graphql(token, 'mutation($i: MediaUploadInput!) { createMediaUpload(input: $i) { key uploadUrl } }', { i: input })).data?.createMediaUpload as { key: string; uploadUrl: string };
    uploadedKeys.push(upload.key);
    const put = await fetch(upload.uploadUrl.replace(/^https?:\/\/[^/]+/, base), { method: 'PUT', body: new Uint8Array([1, 2, 3]) });
    expect(put.status).toBe(200);
    const asset = (await graphql(token, 'mutation($i: RegisterMediaInput!) { registerMedia(input: $i) { id url } }', { i: { ...input, key: upload.key } })).data?.registerMedia as { url: string };
    const file = await fetch(asset.url.replace(/^https?:\/\/[^/]+/, base));
    expect(file.status).toBe(200);
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect((await fetch(`${base}/storage/${upload.key}`)).status).toBe(403);
  });
});
