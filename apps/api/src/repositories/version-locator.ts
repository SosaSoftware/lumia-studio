import type { Database } from '../infrastructure/db/index.ts';
import { AppError } from '../shared/errors/index.ts';
import type { VersionStatus } from '../domain/dto.ts';

export interface VersionOwner {
  versionId: string;
  documentId: string;
  status: VersionStatus;
  /** Category of the class; media used by the version must belong to it. */
  categoryId: string;
}

/** Child tables reachable through a slide; the values are constants, never user input. */
export type SlideChildTable = 'slide_element' | 'pause' | 'audio_clip' | 'slide_comment' | 'narration_clip';

const OWNER_COLUMNS = 'v.id::text as version_id, v.document_id::text as document_id, v.status::text as status, sc.category_id::text as category_id';
/** Joins from a version (`v`) up to the subcategory of its class. */
const TO_CATEGORY = `join studio.class_document d on d.id = v.document_id
         join studio.tree_node n on n.id = d.node_id
         join studio.subcategory sc on sc.id = n.subcategory_id`;

interface OwnerRow {
  version_id: string;
  document_id: string;
  status: VersionStatus;
  category_id: string;
}

/** Finds the version a record belongs to, so edits can be limited to the draft. */
export class VersionLocator {
  public constructor(private readonly db: Database) {}

  public async ofVersion(versionId: string): Promise<VersionOwner> {
    return this.single(
      `select ${OWNER_COLUMNS} from studio.document_version v ${TO_CATEGORY} where v.id = :id::uuid`,
      versionId,
      'La versión no existe.',
    );
  }

  public async ofSlide(slideId: string): Promise<VersionOwner> {
    return this.single(
      `select ${OWNER_COLUMNS} from studio.slide s join studio.document_version v on v.id = s.version_id ${TO_CATEGORY} where s.id = :id::uuid`,
      slideId,
      'La diapositiva no existe.',
    );
  }

  public async ofChild(table: SlideChildTable, id: string): Promise<VersionOwner> {
    return this.single(
      `select ${OWNER_COLUMNS} from studio.${table} c join studio.slide s on s.id = c.slide_id
         join studio.document_version v on v.id = s.version_id ${TO_CATEGORY} where c.id = :id::uuid`,
      id,
      'El recurso no existe.',
    );
  }

  /**
   * Locks the version row (`for update`) and requires it to be a draft. Call it first inside the writing
   * transaction: a concurrent publish waits for the lock, so the check cannot go stale before the write.
   */
  public async lockDraft(versionId: string): Promise<VersionOwner> {
    const owner = await this.single(
      // `of v` locks only the version: edits of other classes in the same subcategory do not wait.
      `select ${OWNER_COLUMNS} from studio.document_version v ${TO_CATEGORY} where v.id = :id::uuid for update of v`,
      versionId,
      'La versión no existe.',
    );
    return VersionLocator.requireDraft(owner);
  }

  /** Throws `Conflict` unless the owner is a draft. */
  public static requireDraft(owner: VersionOwner): VersionOwner {
    if (owner.status !== 'draft') {
      throw AppError.conflict('Solo se puede editar la versión en borrador. Crea una nueva versión para editar la clase.');
    }
    return owner;
  }

  private async single(sql: string, id: string, notFound: string): Promise<VersionOwner> {
    const rows = await this.db.query<OwnerRow>(sql, { id });
    const row = rows[0];
    if (row === undefined) {
      throw AppError.notFound(notFound);
    }
    return { versionId: row.version_id, documentId: row.document_id, status: row.status, categoryId: row.category_id };
  }
}
