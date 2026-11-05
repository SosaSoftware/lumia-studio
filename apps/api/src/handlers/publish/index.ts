import type { AppSyncResolverEvent } from '../../graphql/appsync/index.ts';
import { RuntimeHandler } from '../../runtime/runtime-handler.ts';
import { PublishService } from '../../services/publish-service.ts';
import { publishCommands } from './publish-commands.ts';

const entry = new RuntimeHandler((runtime) => publishCommands(new PublishService(runtime.db, runtime.storage, runtime.exports, runtime.logger)));

/** Lambda entry point for publishing a version. */
export function handler(event: AppSyncResolverEvent): Promise<unknown> {
  return entry.handle(event);
}
