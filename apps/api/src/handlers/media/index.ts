import type { AppSyncResolverEvent } from '../../graphql/appsync/index.ts';
import { RuntimeHandler } from '../../runtime/runtime-handler.ts';
import { MediaService } from '../../services/media-service.ts';
import { mediaCommands } from './media-commands.ts';

const entry = new RuntimeHandler((runtime) => mediaCommands(new MediaService(runtime.db, runtime.storage)));

/** Lambda entry point for the media library and media uploads. */
export function handler(event: AppSyncResolverEvent): Promise<unknown> {
  return entry.handle(event);
}
