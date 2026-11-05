import type { StudioClaims } from '../auth/index.ts';
import type { Database } from '../infrastructure/db/index.ts';
import { AppError } from '../shared/errors/index.ts';
import type { Logger } from '../shared/log/index.ts';
import type { ObjectStorage } from '../infrastructure/storage/index.ts';
import type { ClassDocumentDto } from '../domain/dto.ts';
import { DocumentAssembler } from './document-assembler.ts';
import { NO_EXPORTS } from './export-queue.ts';
import type { ExportQueue } from './export-queue.ts';
import { StudioService } from './studio-service.ts';

/** Publishes the draft version of a document. */
export class PublishService extends StudioService {
  private readonly assembler: DocumentAssembler;

  public constructor(
    db: Database,
    storage: ObjectStorage,
    private readonly exports: ExportQueue = NO_EXPORTS,
    private readonly logger?: Logger,
  ) {
    super(db, storage);
    this.assembler = new DocumentAssembler(this.repos);
  }

  /** Needs at least one slide. The previous published version is archived. */
  public async publish(claims: StudioClaims, documentId: string): Promise<ClassDocumentDto> {
    const document = await this.repos.documents.findById(documentId);
    if (document === null) {
      throw AppError.notFound('El documento no existe.');
    }
    const draft = await this.repos.versions.findWithStatus(documentId, 'draft');
    if (draft === null) {
      throw AppError.conflict('No hay una versión en borrador para publicar.');
    }
    await this.inTransaction(async (repos) => {
      // Same lock order as the editing services (version, then document); an edit in flight finishes first.
      await repos.locator.lockDraft(draft.id);
      await repos.documents.lock(documentId);
      if ((await repos.versions.slideCount(draft.id)) === 0) {
        throw AppError.validation('La versión debe tener al menos una diapositiva para publicarse.');
      }
      const previous = await repos.versions.findWithStatus(documentId, 'published');
      if (previous !== null) {
        await repos.versions.archive(previous.id);
      }
      await repos.versions.publish(draft.id, claims.sub);
      if (this.exports.enabled) {
        await repos.exports.markPending(draft.id);
      }
      await repos.documents.updateState(
        documentId,
        { status: 'published', currentVersion: draft.number, publishedVersion: draft.number },
        claims.sub,
      );
    });
    await this.requestExport(draft.id);
    const updated = await this.repos.documents.findById(documentId);
    if (updated === null) {
      throw AppError.notFound('El documento no existe.');
    }
    return this.assembler.assemble(updated);
  }

  /** The class is published even if the export cannot start; the version keeps the reason and a new publish retries. */
  private async requestExport(versionId: string): Promise<void> {
    if (!this.exports.enabled) return;
    try {
      await this.exports.request(versionId);
    } catch (error) {
      this.logger?.error('Could not start the export of a published version', { versionId, error: error instanceof Error ? error.message : 'unknown error' });
      await this.repos.exports.markFailed(versionId, 'No se pudo iniciar la exportación.');
    }
  }
}
