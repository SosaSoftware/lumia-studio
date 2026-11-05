import type { StudioClaims } from '../auth/index.ts';
import type { Database } from '../infrastructure/db/index.ts';
import { AppError } from '../shared/errors/index.ts';
import type { ObjectStorage } from '../infrastructure/storage/index.ts';
import type { ClassDocumentDto, DocumentVersionDto } from '../domain/dto.ts';
import { isUniqueViolation } from '../support/unique-violation.ts';
import type { DocumentRecord } from '../repositories/document-repository.ts';
import { DocumentAssembler } from './document-assembler.ts';
import { StudioService } from './studio-service.ts';
import { requireClassNode } from './tree-service.ts';

/** Documents and versions of a class. */
export class DocumentService extends StudioService {
  private readonly assembler: DocumentAssembler;

  public constructor(db: Database, storage: ObjectStorage) {
    super(db, storage);
    this.assembler = new DocumentAssembler(this.repos);
  }

  /** Returns null while the class has no document. */
  public async document(nodeId: string): Promise<ClassDocumentDto | null> {
    await requireClassNode((id) => this.repos.tree.node(id), nodeId);
    const record = await this.repos.documents.findByNodeId(nodeId);
    return record === null ? null : this.assembler.assemble(record);
  }

  public async version(versionId: string): Promise<DocumentVersionDto> {
    const version = await this.repos.reader.version(versionId);
    if (version === null) {
      throw AppError.notFound('La versión no existe.');
    }
    return version;
  }

  /** Creates the document of a class with version 1 in draft. */
  public async createDocument(claims: StudioClaims, nodeId: string): Promise<ClassDocumentDto> {
    await requireClassNode((id) => this.repos.tree.node(id), nodeId);
    if ((await this.repos.documents.findByNodeId(nodeId)) !== null) {
      throw AppError.conflict('La clase ya tiene un documento.');
    }
    let documentId: string;
    try {
      documentId = await this.inTransaction(async (repos) => {
        const id = await repos.documents.insertDocument(nodeId, 'draft', 1, claims.sub);
        await repos.versions.insertDraft(id, 1, claims.sub);
        return id;
      });
    } catch (error) {
      throw isUniqueViolation(error) ? AppError.conflict('La clase ya tiene un documento.') : error;
    }
    return this.assembled(documentId);
  }

  /** Creates the next draft as a copy of the published version. */
  public async createVersion(claims: StudioClaims, documentId: string): Promise<DocumentVersionDto> {
    await this.requireDocument(documentId);
    let versionId: string;
    try {
      versionId = await this.inTransaction(async (repos) => {
        // The rules are checked under the document lock, so two callers cannot both create the draft.
        await repos.documents.lock(documentId);
        if ((await repos.versions.findWithStatus(documentId, 'draft')) !== null) {
          throw AppError.conflict('La clase ya tiene una versión en borrador.');
        }
        const published = await repos.versions.findWithStatus(documentId, 'published');
        if (published === null) {
          throw AppError.conflict('La clase no tiene una versión publicada para copiar.');
        }
        const number = await repos.versions.nextNumber(documentId);
        const id = await repos.versions.insertDraft(documentId, number, claims.sub);
        const slides = await repos.slides.orderedIds(published.id);
        await repos.copier.copy(id, slides.map((slideId, index) => ({ slideId, position: index + 1 })));
        await repos.documents.updateState(
          documentId,
          { status: 'draft', currentVersion: number, publishedVersion: published.number },
          claims.sub,
        );
        return id;
      });
    } catch (error) {
      throw isUniqueViolation(error) ? AppError.conflict('La clase ya tiene una versión en borrador.') : error;
    }
    return this.version(versionId);
  }

  private async assembled(documentId: string): Promise<ClassDocumentDto> {
    return this.assembler.assemble(await this.requireDocument(documentId));
  }

  private async requireDocument(documentId: string): Promise<DocumentRecord> {
    const record = await this.repos.documents.findById(documentId);
    if (record === null) {
      throw AppError.notFound('El documento no existe.');
    }
    return record;
  }
}
