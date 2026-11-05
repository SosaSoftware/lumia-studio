import type { AppSyncResolverEvent } from '../../graphql/appsync/index.ts';
import { RuntimeHandler } from '../../runtime/runtime-handler.ts';
import { CatalogService } from '../../services/catalog-service.ts';
import { DocumentService } from '../../services/document-service.ts';
import { SlideService } from '../../services/slide-service.ts';
import { TimelineService } from '../../services/timeline-service.ts';
import { documentsCommands } from './documents-commands.ts';

const entry = new RuntimeHandler((runtime) =>
  documentsCommands({
    documents: new DocumentService(runtime.db, runtime.storage),
    slides: new SlideService(runtime.db, runtime.storage),
    timeline: new TimelineService(runtime.db, runtime.storage),
    catalog: new CatalogService(),
  }),
);

/** Lambda entry point for documents, versions, slides, elements, pauses, audio clips, comments and the catalog. */
export function handler(event: AppSyncResolverEvent): Promise<unknown> {
  return entry.handle(event);
}
