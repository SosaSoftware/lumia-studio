import type { Database } from '../infrastructure/db/index.ts';
import { isoTimestamp } from '../infrastructure/db/sql-functions.ts';

export interface NamedLevel {
  readonly name: string;
  readonly displayName: string;
}

export interface GroupedLevel extends NamedLevel {
  /** Visual group of the menus; part of the export path when there is one. */
  readonly groupName: string | null;
}

/** Where a published version sits in the tree, as the export path and `definition.json` need it. */
export interface ExportSource {
  readonly versionId: string;
  readonly documentId: string;
  readonly nodeId: string;
  readonly number: number;
  readonly status: string;
  readonly publishedAt: string | null;
  readonly publishedBy: string | null;
  readonly node: NamedLevel & { readonly description: string };
  readonly category: GroupedLevel;
  readonly subcategory: GroupedLevel;
  /** Folders from the root of the subcategory down to the folder of the class. */
  readonly folders: readonly NamedLevel[];
}

/** A medium of the library as stored. */
export interface StoredMedia {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

/** Stored files of a narration clip whose voice was generated. */
export interface StoredNarration {
  readonly id: string;
  readonly audioKey: string;
  readonly speechMarksKey: string | null;
}

interface SourceRow {
  version_id: string;
  document_id: string;
  node_id: string;
  number: number;
  status: string;
  published_at: string | null;
  published_by: string | null;
  node_name: string;
  node_display_name: string;
  node_description: string;
  subcategory_name: string;
  subcategory_display_name: string;
  subcategory_group: string | null;
  category_name: string;
  category_display_name: string;
  category_group: string | null;
}

/** Reads what an export needs and records where the export went. */
export class ExportRepository {
  public constructor(private readonly db: Database) {}

  public async source(versionId: string): Promise<ExportSource | null> {
    const [row] = await this.db.query<SourceRow>(
      `select v.id::text as version_id, d.id::text as document_id, n.id::text as node_id, v.number, v.status::text as status,
              ${isoTimestamp('v.published_at')} as published_at, v.published_by,
              n.name as node_name, n.display_name as node_display_name, n.description as node_description,
              s.name as subcategory_name, s.display_name as subcategory_display_name, s.group_name as subcategory_group,
              c.name as category_name, c.display_name as category_display_name, c.group_name as category_group
         from studio.document_version v
         join studio.class_document d on d.id = v.document_id
         join studio.tree_node n on n.id = d.node_id
         join studio.subcategory s on s.id = n.subcategory_id
         join studio.category c on c.id = s.category_id
        where v.id = :versionId::uuid`,
      { versionId },
    );
    if (row === undefined) return null;
    const folders = await this.db.query<{ name: string; display_name: string }>(
      `with recursive chain as (
         select n.parent_id, 0 as depth, n.name, n.display_name from studio.tree_node n where n.id = :nodeId::uuid
         union all
         select p.parent_id, c.depth + 1, p.name, p.display_name from studio.tree_node p join chain c on p.id = c.parent_id
       )
       select name, display_name from chain where depth > 0 order by depth desc`,
      { nodeId: row.node_id },
    );
    return {
      versionId: row.version_id,
      documentId: row.document_id,
      nodeId: row.node_id,
      number: row.number,
      status: row.status,
      publishedAt: row.published_at,
      publishedBy: row.published_by,
      node: { name: row.node_name, displayName: row.node_display_name, description: row.node_description },
      category: { name: row.category_name, displayName: row.category_display_name, groupName: row.category_group },
      subcategory: { name: row.subcategory_name, displayName: row.subcategory_display_name, groupName: row.subcategory_group },
      folders: folders.map((folder) => ({ name: folder.name, displayName: folder.display_name })),
    };
  }

  public async media(ids: readonly string[]): Promise<StoredMedia[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.query<{ id: string; s3_key: string; name: string; mime_type: string; size_bytes: number }>(
      `select id::text as id, s3_key, name, mime_type, size_bytes::float8 as size_bytes
         from studio.media_asset where id::text = any(string_to_array(:ids, ',')) order by id`,
      { ids: ids.join(',') },
    );
    return rows.map((row) => ({ id: row.id, key: row.s3_key, name: row.name, mimeType: row.mime_type, sizeBytes: row.size_bytes }));
  }

  public async narration(versionId: string): Promise<StoredNarration[]> {
    const rows = await this.db.query<{ id: string; audio_key: string; speech_marks_key: string | null }>(
      `select c.id::text as id, c.audio_key, c.speech_marks_key
         from studio.narration_clip c join studio.slide s on s.id = c.slide_id
        where s.version_id = :versionId::uuid and c.audio_key is not null
        order by c.id`,
      { versionId },
    );
    return rows.map((row) => ({ id: row.id, audioKey: row.audio_key, speechMarksKey: row.speech_marks_key }));
  }

  /** Whether the version is still the published one; a later publish archives it. */
  public async isPublished(versionId: string): Promise<boolean> {
    const rows = await this.db.query<{ status: string }>('select status::text as status from studio.document_version where id = :versionId::uuid', { versionId });
    return rows[0]?.status === 'published';
  }

  public async markPending(versionId: string): Promise<void> {
    await this.db.execute(
      `update studio.document_version set export_status = 'pending', export_error = null where id = :versionId::uuid`,
      { versionId },
    );
  }

  public async markReady(versionId: string, key: string, objectVersion: string | null): Promise<void> {
    await this.db.execute(
      `update studio.document_version
          set export_status = 'ready', export_key = :key, export_object_version = :objectVersion, exported_at = now(), export_error = null
        where id = :versionId::uuid`,
      { versionId, key, objectVersion },
    );
  }

  public async markFailed(versionId: string, message: string): Promise<void> {
    await this.db.execute(
      `update studio.document_version set export_status = 'failed', export_error = :message where id = :versionId::uuid`,
      { versionId, message: message.slice(0, 1000) },
    );
  }
}
