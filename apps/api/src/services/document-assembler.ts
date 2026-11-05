import { AppError } from '../shared/errors/index.ts';
import type { ClassDocumentDto } from '../domain/dto.ts';
import type { DocumentRecord } from '../repositories/document-repository.ts';
import type { RepositorySet } from '../repositories/repository-set.ts';

/** Builds the `ClassDocument` response: summary, versions and the version being edited. */
export class DocumentAssembler {
  public constructor(private readonly repos: RepositorySet) {}

  public async assemble(record: DocumentRecord): Promise<ClassDocumentDto> {
    const versions = await this.repos.versions.list(record.id);
    const editing =
      (await this.repos.versions.findWithStatus(record.id, 'draft')) ??
      (await this.repos.versions.findWithStatus(record.id, 'published'));
    if (editing === null) {
      throw AppError.internal('El documento no tiene una versión editable.');
    }
    const version = await this.repos.reader.version(editing.id);
    if (version === null) {
      throw AppError.internal('El documento no tiene una versión editable.');
    }
    return {
      id: record.id,
      nodeId: record.nodeId,
      status: record.status,
      currentVersion: record.currentVersion,
      publishedVersion: record.publishedVersion,
      updatedAt: record.updatedAt,
      versions: versions.map((v) => ({
        id: v.id,
        number: v.number,
        status: v.status,
        createdAt: v.createdAt,
        publishedAt: v.publishedAt,
      })),
      editingVersion: version,
    };
  }
}
