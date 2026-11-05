import type { Database } from '../infrastructure/db/index.ts';
import { isoTimestamp } from '../infrastructure/db/sql-functions.ts';

export interface MediaRecord {
  id: string;
  categoryId: string;
  key: string;
  mimeType: string;
  name: string;
  sizeBytes: number;
  createdAt: string;
}

export interface MediaQuery {
  categoryId: string;
  mimePrefix: string;
  text: string;
  limit: number;
  offset: number;
}

interface MediaRow {
  id: string;
  category_id: string;
  s3_key: string;
  mime_type: string;
  name: string;
  size_bytes: number;
  created_at: string;
}

const SELECT = `select id::text as id, category_id::text as category_id, s3_key, mime_type, name, size_bytes,
       ${isoTimestamp('created_at')} as created_at from studio.media_asset`;

function toRecord(row: MediaRow): MediaRecord {
  return {
    id: row.id,
    categoryId: row.category_id,
    key: row.s3_key,
    mimeType: row.mime_type,
    name: row.name,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  };
}

/** `media_asset`. */
export class MediaRepository {
  public constructor(private readonly db: Database) {}

  public async find(id: string): Promise<MediaRecord | null> {
    const rows = await this.db.query<MediaRow>(`${SELECT} where id = :id::uuid`, { id });
    const row = rows[0];
    return row === undefined ? null : toRecord(row);
  }

  public async findByKey(key: string): Promise<MediaRecord | null> {
    const rows = await this.db.query<MediaRow>(`${SELECT} where s3_key = :key`, { key });
    const row = rows[0];
    return row === undefined ? null : toRecord(row);
  }

  /** Ids from `ids` that do not exist in the library of the category. */
  public async missing(ids: readonly string[], categoryId: string): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.db.query<{ id: string }>(
      `select id::text as id from studio.media_asset
        where id::text = any(string_to_array(:ids, ',')) and category_id = :categoryId::uuid`,
      { ids: ids.join(','), categoryId },
    );
    const found = new Set(rows.map((row) => row.id));
    return ids.filter((id) => !found.has(id));
  }

  public async insert(record: Omit<MediaRecord, 'createdAt'>, uploadedBy: string): Promise<void> {
    await this.db.execute(
      `insert into studio.media_asset (id, category_id, s3_key, mime_type, name, size_bytes, uploaded_by)
       values (:id::uuid, :categoryId::uuid, :key, :mimeType, :name, :sizeBytes, :uploadedBy)`,
      {
        id: record.id,
        categoryId: record.categoryId,
        key: record.key,
        mimeType: record.mimeType,
        name: record.name,
        sizeBytes: record.sizeBytes,
        uploadedBy,
      },
    );
  }

  /** One page, newest first; asks for `limit` rows and the caller passes `limit + 1` to detect more. */
  public async search(query: MediaQuery): Promise<MediaRecord[]> {
    const rows = await this.db.query<MediaRow>(
      `${SELECT}
        where category_id = :categoryId::uuid
          and (:mimePrefix = '' or starts_with(mime_type, :mimePrefix))
          and (:text = '' or position(lower(:text) in lower(name)) > 0)
        order by created_at desc, id desc
        limit :limit offset :offset`,
      { categoryId: query.categoryId, mimePrefix: query.mimePrefix, text: query.text, limit: query.limit, offset: query.offset },
    );
    return rows.map(toRecord);
  }
}
