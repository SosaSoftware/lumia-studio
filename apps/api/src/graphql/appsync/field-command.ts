import type { AppSyncResolverEvent } from './appsync-event.ts';

/** Command that resolves one GraphQL field (Command pattern). */
export interface FieldCommand {
  execute(event: AppSyncResolverEvent): Promise<unknown>;
}
