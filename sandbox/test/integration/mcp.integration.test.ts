import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Config, ProcessEnvSource } from '@lumia/api/config';
import { createDatabase } from '@lumia/api/db';
import type { CloseableDatabase, SqlValue } from '@lumia/api/db';
import { Logger } from '@lumia/api/log';
import { MCP_TARGETS, STUDIO_TOKEN_HEADER, createToolHandler } from '@lumia/api/mcp';
import type { McpTarget } from '@lumia/api/mcp';
import { SandboxServer } from '../../src/sandbox-server.ts';

// Runs the Studio MCP tools against the sandbox API, as the gateway would call them. The test has its own
// category, class and people (prefix below) and removes them at the end; seeded content is not touched.
const PREFIX = 'itest-mcp';
const quiet = new Logger({}, { write: () => undefined });
let server: SandboxServer;
let base: string;
let admin: CloseableDatabase;
const fixture = { categoryId: '', subcategoryId: '', nodeId: '' };
const tokens = { creator: '', viewer: '' };

type Json = Record<string, unknown>;

function isJson(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function json(value: unknown): Json {
  if (!isJson(value)) throw new Error(`Expected an object, got ${JSON.stringify(value)}`);
  return value;
}

function items(value: unknown): Json[] {
  return Array.isArray(value) ? value.map(json) : [];
}

async function insertId(sql: string, params: Readonly<Record<string, SqlValue>>): Promise<string> {
  const [row] = await admin.query<{ id: string }>(sql, params);
  if (row === undefined) throw new Error(`No id from: ${sql}`);
  return row.id;
}

async function removeFixture(): Promise<void> {
  await admin.execute(
    `delete from studio.class_document d using studio.tree_node n, studio.subcategory s, studio.category c
      where d.node_id = n.id and n.subcategory_id = s.id and s.category_id = c.id and c.name = :name`,
    { name: PREFIX },
  );
  await admin.execute('delete from studio.category where name = :name', { name: PREFIX });
  await admin.execute('delete from studio.app_user where email like :pattern', { pattern: `%@${PREFIX}.test` });
}

async function tokenOf(email: string): Promise<string> {
  const response = await fetch(`${base}/dev/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
  const token = json(await response.json()).token;
  if (typeof token !== 'string') throw new Error(`No token for ${email}`);
  return token;
}

async function tool(target: McpTarget, name: string, args: Json, token: string = tokens.creator): Promise<Json> {
  const handler = createToolHandler(target, { graphqlUrl: () => `${base}/graphql`, logger: quiet, targets: Object.values(MCP_TARGETS) });
  return json(await handler(args, { clientContext: { custom: { bedrockAgentCoreToolName: `${target.name}___${name}`, bedrockAgentCorePropagatedHeaders: { [STUDIO_TOKEN_HEADER]: token } } } }));
}

beforeAll(async () => {
  const config = new Config(new ProcessEnvSource());
  server = await SandboxServer.create(config, quiet);
  base = `http://localhost:${String(await server.listen(0))}`;
  admin = createDatabase('admin', config);
  await removeFixture();
  fixture.categoryId = await insertId(`insert into studio.category (name, display_name) values (:name, 'Prueba MCP') returning id::text as id`, { name: PREFIX });
  fixture.subcategoryId = await insertId(
    `insert into studio.subcategory (category_id, name, display_name) values (:category::uuid, 'pruebas', 'Pruebas') returning id::text as id`,
    { category: fixture.categoryId },
  );
  fixture.nodeId = await insertId(
    `insert into studio.tree_node (subcategory_id, parent_id, kind, name, display_name, position)
     values (:subcategory::uuid, null, 'class', 'prueba.lumia', 'Prueba', 1) returning id::text as id`,
    { subcategory: fixture.subcategoryId },
  );
  for (const [email, name, role] of [
    [`creadora@${PREFIX}.test`, 'Creadora MCP', 'content_creator'],
    [`lectora@${PREFIX}.test`, 'Lectora MCP', 'viewer'],
  ] as const) {
    const userId = await insertId(
      `insert into studio.app_user (email, name, role_id) select :email, :name, id from studio.role where key = :role returning id::text as id`,
      { email, name, role },
    );
    await admin.execute('insert into studio.access_grant (user_id, category_id) values (:user::uuid, :category::uuid)', { user: userId, category: fixture.categoryId });
  }
  tokens.creator = await tokenOf(`creadora@${PREFIX}.test`);
  tokens.viewer = await tokenOf(`lectora@${PREFIX}.test`);
});

afterAll(async () => {
  await removeFixture();
  await server.close();
  await admin.close();
});

describe('Studio MCP against the sandbox API', () => {
  it('tells each person what their role allows', async () => {
    expect((await tool(MCP_TARGETS.read, 'get_my_access', {})).actions).toEqual(expect.arrayContaining(['documents.view', 'documents.edit', 'documents.publish']));
    const viewer = await tool(MCP_TARGETS.read, 'get_my_access', {}, tokens.viewer);
    expect(viewer).toMatchObject({ name: 'Lectora MCP', role: { key: 'viewer' }, actions: ['documents.view'] });
    expect(viewer.tools).toEqual(MCP_TARGETS.read.tools.map((readTool) => `studio-read___${readTool.name}`));
  });

  it('finds the empty class in the tree of its subcategory', async () => {
    const categories = items((await tool(MCP_TARGETS.read, 'list_categories', {})).categories);
    expect(categories.find((category) => category.id === fixture.categoryId)).toMatchObject({ displayName: 'Prueba MCP', subcategories: [{ name: 'pruebas' }] });
    const nodes = items((await tool(MCP_TARGETS.read, 'list_tree', { subcategoryId: fixture.subcategoryId })).nodes);
    expect(nodes).toEqual([expect.objectContaining({ id: fixture.nodeId, kind: 'class', path: 'prueba.lumia', status: 'no_content' })]);
  });

  it('creates the content of the class, reads it and edits one component', async () => {
    const added = await tool(MCP_TARGETS.slides, 'add_slides', {
      nodeId: fixture.nodeId,
      slides: [
        { type: 'cover', title: 'Bienvenida' },
        { type: 'explanatory', title: 'Qué aprenderás', elements: [{ component: 'title', props: { text: 'Qué aprenderás' } }] },
      ],
    });
    expect(added).toMatchObject({ draft: { versionNumber: 1 }, slides: [{ position: 1, title: 'Bienvenida' }, { position: 2, title: 'Qué aprenderás' }] });
    const summary = await tool(MCP_TARGETS.read, 'get_class', { nodeId: fixture.nodeId });
    expect(summary).toMatchObject({ status: 'draft', editing: { number: 1, status: 'draft' } });
    expect(items(summary.slides).map((slide) => slide.components)).toEqual([['title', 'paragraph'], ['title']]);

    const firstSlideId = String(items(added.slides)[0]?.id);
    const slide = json((await tool(MCP_TARGETS.read, 'get_slide', { nodeId: fixture.nodeId, slideId: firstSlideId })).slide);
    const title = items(slide.elements).find((element) => element.component === 'title');
    const updated = await tool(MCP_TARGETS.elements, 'update_element', { nodeId: fixture.nodeId, elementId: String(title?.id), props: { text: 'Hola' } });
    expect(json(json(updated.element).props)).toEqual({ ...json(title?.props), text: 'Hola' });

    const invalid = await tool(MCP_TARGETS.elements, 'add_element', { nodeId: fixture.nodeId, slideId: firstSlideId, component: 'title', props: { level: 'h9' } });
    expect(invalid).toMatchObject({ error: { code: 'invalid_input' } });
  });

  it('answers "Permisos insuficientes" when the role does not allow the change', async () => {
    const denied = await tool(MCP_TARGETS.slides, 'add_slides', { nodeId: fixture.nodeId, slides: [{ type: 'cover', title: 'No' }] }, tokens.viewer);
    expect(denied).toMatchObject({ error: { code: 'forbidden', message: expect.stringMatching(/^Permisos insuficientes: /) as string } });
    expect(items((await tool(MCP_TARGETS.read, 'get_class', { nodeId: fixture.nodeId }, tokens.viewer)).slides)).toHaveLength(2);
  });

  it('opens a new draft when the class is published and moves to the new ids', async () => {
    const before = await tool(MCP_TARGETS.read, 'get_class', { nodeId: fixture.nodeId });
    const publish = await fetch(`${base}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: tokens.creator },
      body: JSON.stringify({ query: 'mutation($d: ID!) { publishVersion(documentId: $d) { status } }', variables: { d: before.documentId } }),
    });
    expect(json(json(json(await publish.json()).data).publishVersion).status).toBe('published');

    const publishedSlideId = String(items(before.slides)[0]?.id);
    const changed = await tool(MCP_TARGETS.slides, 'update_slide', { nodeId: fixture.nodeId, slideId: publishedSlideId, title: 'Bienvenida otra vez' });
    expect(changed).toMatchObject({ draft: { versionNumber: 2 }, slide: { position: 1, title: 'Bienvenida otra vez' } });
    expect(json(changed.slide).id).not.toBe(publishedSlideId);
    expect(json(json(changed.draft).idMap)[publishedSlideId]).toBe(json(changed.slide).id);
    expect(await tool(MCP_TARGETS.read, 'get_class', { nodeId: fixture.nodeId })).toMatchObject({ currentVersion: 2, publishedVersion: 1, editing: { number: 2, status: 'draft' } });
  });
});
