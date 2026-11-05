import type { AppSyncResolverEvent } from '../../graphql/appsync/index.ts';
import { RuntimeHandler } from '../../runtime/runtime-handler.ts';
import { NarrationService } from '../../services/narration-service.ts';
import { narrationCommands } from './narration-commands.ts';

const entry = new RuntimeHandler((runtime) =>
  narrationCommands(new NarrationService(runtime.db, runtime.storage, runtime.speech, runtime.logger)),
);

/** Lambda entry point for narration generation. */
export function handler(event: AppSyncResolverEvent): Promise<unknown> {
  return entry.handle(event);
}
