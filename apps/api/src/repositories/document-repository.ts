import { randomUUID } from 'node:crypto';
import type { Database } from '../infrastructure/db/index.ts';
import { isoTimestamp } from '../infrastructure/db/sql-functions.ts';

/** Status stored for a document; a class without a document shows as `no_content`. */
export type StoredDocumentStatus = 'draft' | 'published';

export interface DocumentRecord {
  id: string;
  nodeId: string;
  status: StoredDocumentStatus;
  currentVersion: number;
  publishedVersion: number | null;
  updatedAt: string;
}

interface DocumentRow {
  id: string;
  node_id: string;
  status: StoredDocumentStatus;
  current_version: number;
  published_version: number | null;
  updated_at: string;
}

const SELECT = `select d.id::text as id, d.node_id::text as node_id, d.status::text as status, d.current_version,
       d.published_version, ${isoTimestamp('d.updated_at')} as updated_at
  from studio.class_document d`;

function toRecord(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    nodeId: row.node_id,
    status: row.status,
    currentVersion: row.current_version,
    publishedVersion: row.published_version,
    updatedAt: row.updated_at,
  };
}

/** `class_document`: the content of one class node. */
export class DocumentRepository {
  public constructor(private readonly db: Database) {}

  public async findByNodeId(nodeId: string): Promise<DocumentRecord | null> {
    const rows = await this.db.query<DocumentRow>(`${SELECT} where d.node_id = :nodeId::uuid`, { nodeId });
    const row = rows[0];
    return row === undefined ? null : toRecord(row);
  }

  public async findById(documentId: string): Promise<DocumentRecord | null> {
    const rows = await this.db.query<DocumentRow>(`${SELECT} where d.id = :id::uuid`, { id: documentId });
    const row = rows[0];
    return row === undefined ? null : toRecord(row);
  }

  /** Locks the `class_document` row until the end of the transaction. */
  public async lock(documentId: string): Promise<void> {
    await this.db.query('select id from studio.class_document where id = :id::uuid for update', { id: documentId });
  }

  public async insertDocument(nodeId: string, status: StoredDocumentStatus, currentVersion: number, updatedBy: string): Promise<string> {
    const id = randomUUID();
    await this.db.execute(
      `insert into studio.class_document (id, node_id, status, current_version, updated_by)
       values (:id::uuid, :nodeId::uuid, :status::studio.document_status, :currentVersion, :updatedBy)`,
      { id, nodeId, status, currentVersion, updatedBy },
    );
    return id;
  }

  public async updateState(
    documentId: string,
    state: { status: StoredDocumentStatus; currentVersion: number; publishedVersion: number | null },
    updatedBy: string,
  ): Promise<void> {
    await this.db.execute(
      `update studio.class_document
          set status = :status::studio.document_status, current_version = :currentVersion,
              published_version = :publishedVersion, updated_by = :updatedBy, updated_at = now()
        where id = :id::uuid`,
      { id: documentId, ...state, updatedBy },
    );
  }

  /** Records that the document changed. */
  public async touch(documentId: string, updatedBy: string): Promise<void> {
    await this.db.execute(
      'update studio.class_document set updated_by = :updatedBy, updated_at = now() where id = :id::uuid',
      { id: documentId, updatedBy },
    );
  }
}
