import type { Database } from '../infrastructure/db/index.ts';
import type { ObjectStorage, PublishedStore } from '../infrastructure/storage/index.ts';
import { ExportRepository } from '../repositories/export-repository.ts';
import { VersionReader } from '../repositories/version-reader.ts';
import type { ArchiveFile } from './lumia-archive.ts';
import { buildArchive, buildDefinition, exportKey, mediaPath, narrationPaths, referencedMedia } from './lumia-archive.ts';

export const LUMIA_CONTENT_TYPE = 'application/zip';

/** Where an export went. */
export interface ExportResult {
  readonly key: string;
  readonly objectVersion: string | null;
}

/**
 * Exports a published version as a .lumia file: `definition.json` with the content and the media it uses, stored at a
 * path that follows the tree. A version that is no longer the published one is skipped, so an older export never
 * replaces a newer one.
 */
export class ExportService {
  private readonly exports: ExportRepository;
  private readonly reader: VersionReader;

  public constructor(
    db: Database,
    private readonly media: ObjectStorage,
    private readonly published: PublishedStore,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.exports = new ExportRepository(db);
    this.reader = new VersionReader(db, media);
  }

  /** @returns where the file went, or null when the version is not the published one anymore. */
  public async export(versionId: string): Promise<ExportResult | null> {
    const source = await this.exports.source(versionId);
    if (source?.status !== 'published') return null;
    const version = await this.reader.version(versionId);
    if (version === null) return null;
    const media = await this.exports.media(referencedMedia(version));
    const narration = await this.exports.narration(versionId);
    const files: ArchiveFile[] = [];
    for (const item of media) files.push({ path: mediaPath(item), body: await this.media.get(item.key) });
    for (const clip of narration) {
      const paths = narrationPaths(clip);
      files.push({ path: paths.audio, body: await this.media.get(clip.audioKey) });
      if (paths.speechMarks !== null && clip.speechMarksKey !== null) files.push({ path: paths.speechMarks, body: await this.media.get(clip.speechMarksKey) });
    }
    const archive = buildArchive(buildDefinition(source, version, media, narration, this.now()), files);
    const key = exportKey(source);
    // A later publish may have archived this version while its files were read.
    if (!(await this.exports.isPublished(versionId))) return null;
    const { versionId: objectVersion } = await this.published.put(key, archive, LUMIA_CONTENT_TYPE);
    await this.exports.markReady(versionId, key, objectVersion);
    return { key, objectVersion };
  }

  /** Records why the export failed; publishing again exports the class again. */
  public async fail(versionId: string, message: string): Promise<void> {
    await this.exports.markFailed(versionId, message);
  }
}
