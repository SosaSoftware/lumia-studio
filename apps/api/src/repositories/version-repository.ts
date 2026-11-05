import { randomUUID } from 'node:crypto';
import type { Database } from '../infrastructure/db/index.ts';
import { isoTimestamp } from '../infrastructure/db/sql-functions.ts';
import type { VersionStatus } from '../domain/dto.ts';

export interface VersionRecord {
  id: string;
  documentId: string;
  number: number;
  status: VersionStatus;
  createdAt: string;
  createdBy: string;
  publishedAt: string | null;
  publishedBy: string | null;
}

interface VersionRow {
  id: string;
  document_id: string;
  number: number;
  status: VersionStatus;
  created_at: string;
  created_by: string;
  published_at: string | null;
  published_by: string | null;
}

const SELECT = `select id::text as id, document_id::text as document_id, number, status::text as status,
       ${isoTimestamp('created_at')} as created_at, created_by, ${isoTimestamp('published_at')} as published_at, published_by
  from studio.document_version`;

function toRecord(row: VersionRow): VersionRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    number: row.number,
    status: row.status,
    createdAt: row.created_at,
    createdBy: row.created_by,
    publishedAt: row.published_at,
    publishedBy: row.published_by,
  };
}

/** `document_version`. */
export class VersionRepository {
  public constructor(private readonly db: Database) {}

  public async findById(id: string): Promise<VersionRecord | null> {
    const rows = await this.db.query<VersionRow>(`${SELECT} where id = :id::uuid`, { id });
    const row = rows[0];
    return row === undefined ? null : toRecord(row);
  }

  public async findWithStatus(documentId: string, status: VersionStatus): Promise<VersionRecord | null> {
    const rows = await this.db.query<VersionRow>(
      `${SELECT} where document_id = :documentId::uuid and status = :status::studio.version_status order by number desc limit 1`,
      { documentId, status },
    );
    const row = rows[0];
    return row === undefined ? null : toRecord(row);
  }

  public async list(documentId: string): Promise<VersionRecord[]> {
    const rows = await this.db.query<VersionRow>(`${SELECT} where document_id = :documentId::uuid order by number`, { documentId });
    return rows.map(toRecord);
  }

  public async nextNumber(documentId: string): Promise<number> {
    const rows = await this.db.query<{ next: number }>(
      'select coalesce(max(number), 0) + 1 as next from studio.document_version where document_id = :documentId::uuid',
      { documentId },
    );
    return rows[0]?.next ?? 1;
  }

  public async insertDraft(documentId: string, number: number, createdBy: string): Promise<string> {
    const id = randomUUID();
    await this.db.execute(
      `insert into studio.document_version (id, document_id, number, status, created_by)
       values (:id::uuid, :documentId::uuid, :number, 'draft', :createdBy)`,
      { id, documentId, number, createdBy },
    );
    return id;
  }

  public async archive(id: string): Promise<void> {
    await this.db.execute("update studio.document_version set status = 'archived' where id = :id::uuid", { id });
  }

  public async publish(id: string, publishedBy: string): Promise<void> {
    await this.db.execute(
      `update studio.document_version set status = 'published', published_by = :publishedBy, published_at = now()
        where id = :id::uuid`,
      { id, publishedBy },
    );
  }

  public async slideCount(versionId: string): Promise<number> {
    const rows = await this.db.query<{ total: number }>(
      'select count(*)::int as total from studio.slide where version_id = :versionId::uuid',
      { versionId },
    );
    return rows[0]?.total ?? 0;
  }
}
