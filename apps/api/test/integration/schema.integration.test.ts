import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/infrastructure/db/index.ts';
import type { CloseableDatabase } from '../../src/infrastructure/db/index.ts';

let admin: CloseableDatabase;

beforeAll(() => {
  admin = createDatabase('admin');
});

afterAll(async () => {
  await admin.close();
});

const PREFIX = 'itest-schema';

async function insertNode(subcategoryId: string, parentId: string | null, kind: 'folder' | 'class', name: string): Promise<string> {
  const rows = await admin.query<{ id: string }>(
    `insert into studio.tree_node (subcategory_id, parent_id, kind, name, display_name)
     values (:subcategoryId::uuid, :parentId::uuid, :kind::studio.tree_node_kind, :name, :name) returning id::text as id`,
    { subcategoryId, parentId, kind, name },
  );
  return rows[0]?.id ?? '';
}

describe('studio schema', () => {
  it('has the Studio tables only', async () => {
    const rows = await admin.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'studio' and table_type = 'BASE TABLE'`,
    );
    expect(rows.map((row) => row.table_name).sort()).toEqual([
      'access_grant', 'app_user', 'audio_clip', 'category', 'class_document', 'document_version', 'media_asset', 'narration_clip',
      'pause', 'role', 'role_permission', 'schema_migration', 'slide', 'slide_comment', 'slide_element', 'subcategory', 'tree_node',
    ]);
  });

  it('defines the studio enums', async () => {
    const rows = await admin.query<{ name: string; labels: string }>(
      `select t.typname as name, string_agg(e.enumlabel, ',' order by e.enumsortorder) as labels
       from pg_type t join pg_enum e on e.enumtypid = t.oid
       join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'studio' group by t.typname`,
    );
    expect(Object.fromEntries(rows.map((row) => [row.name, row.labels]))).toEqual({
      tree_node_kind: 'folder,class',
      user_status: 'active,disabled',
      document_status: 'draft,published',
      version_status: 'draft,published,archived',
      slide_type: 'cover,explanatory,video,interactive_video,whiteboard,quiz,closing',
      transition: 'none,fade,slide,zoom',
      advance_mode: 'auto,click,on_complete',
      entrance: 'none,appear,fade,slide,draw',
      narration_status: 'pending,generating,ready,failed',
      audio_kind: 'music,effect',
      pause_end: 'continue,wait_click',
    });
  });

  it('allows a single draft version per document', async () => {
    const rows = await admin.query<{ indexdef: string }>(`select indexdef from pg_indexes where schemaname = 'studio' and tablename = 'document_version'`);
    expect(rows.some((row) => /UNIQUE.*\(document_id\).*WHERE/s.test(row.indexdef))).toBe(true);
  });

  it('enforces the rules of the tree: names, unique siblings, classes as leaves and documents only on classes', async () => {
    await admin.execute('delete from studio.category where name = :name', { name: PREFIX });
    try {
      const category = await admin.query<{ id: string }>(`insert into studio.category (name, display_name) values (:name, 'Esquema') returning id::text as id`, { name: PREFIX });
      const subcategory = await admin.query<{ id: string }>(
        `insert into studio.subcategory (category_id, name, display_name) values (:categoryId::uuid, 'general', 'General') returning id::text as id`,
        { categoryId: category[0]?.id ?? '' },
      );
      const subcategoryId = subcategory[0]?.id ?? '';
      const folder = await insertNode(subcategoryId, null, 'folder', 'semana-1');
      const lesson = await insertNode(subcategoryId, folder, 'class', 'clase-1.lumia');
      await expect(insertNode(subcategoryId, folder, 'class', 'clase-1.lumia')).rejects.toThrow();
      await expect(insertNode(subcategoryId, folder, 'class', 'Clase Uno.lumia')).rejects.toThrow();
      await expect(insertNode(subcategoryId, folder, 'class', 'sin-extension')).rejects.toThrow();
      await expect(insertNode(subcategoryId, lesson, 'folder', 'dentro-de-una-clase')).rejects.toThrow();
      expect(await insertNode(subcategoryId, null, 'class', 'clase-1.lumia')).not.toBe('');
      await expect(
        admin.execute(`insert into studio.class_document (node_id, updated_by) values (:nodeId::uuid, 'test')`, { nodeId: folder }),
      ).rejects.toThrow();
      await admin.execute(`insert into studio.class_document (node_id, updated_by) values (:nodeId::uuid, 'test')`, { nodeId: lesson });
      await expect(admin.execute('delete from studio.tree_node where id = :id::uuid', { id: lesson })).rejects.toThrow();
      await admin.execute('delete from studio.class_document where node_id = :id::uuid', { id: lesson });
    } finally {
      await admin.execute('delete from studio.category where name = :name', { name: PREFIX });
    }
  });
});
