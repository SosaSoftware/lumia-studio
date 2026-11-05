import type { Database } from '../infrastructure/db/index.ts';
import type { ObjectStorage } from '../infrastructure/storage/index.ts';
import { DocumentRepository } from './document-repository.ts';
import { ElementRepository } from './element-repository.ts';
import { ExportRepository } from './export-repository.ts';
import { MediaRepository } from './media-repository.ts';
import { NarrationRepository } from './narration-repository.ts';
import { SlideCopier } from './slide-copier.ts';
import { SlideRepository } from './slide-repository.ts';
import { TimelineRepository } from './timeline-repository.ts';
import { TreeRepository } from './tree-repository.ts';
import { VersionLocator } from './version-locator.ts';
import { VersionReader } from './version-reader.ts';
import { VersionRepository } from './version-repository.ts';

/** Every repository bound to one `Database`, so a service can rebind them all to a transaction. */
export class RepositorySet {
  private constructor(
    public readonly documents: DocumentRepository,
    public readonly versions: VersionRepository,
    public readonly locator: VersionLocator,
    public readonly slides: SlideRepository,
    public readonly elements: ElementRepository,
    public readonly timeline: TimelineRepository,
    public readonly media: MediaRepository,
    public readonly narration: NarrationRepository,
    public readonly copier: SlideCopier,
    public readonly reader: VersionReader,
    public readonly tree: TreeRepository,
    public readonly exports: ExportRepository,
  ) {}

  public static on(db: Database, storage: ObjectStorage): RepositorySet {
    return new RepositorySet(
      new DocumentRepository(db),
      new VersionRepository(db),
      new VersionLocator(db),
      new SlideRepository(db),
      new ElementRepository(db),
      new TimelineRepository(db),
      new MediaRepository(db),
      new NarrationRepository(db),
      new SlideCopier(db),
      new VersionReader(db, storage),
      new TreeRepository(db),
      new ExportRepository(db),
    );
  }
}
