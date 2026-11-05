import type { AppSyncResolverEvent } from '../../graphql/appsync/index.ts';
import { RuntimeHandler } from '../../runtime/runtime-handler.ts';
import { TreeService } from '../../services/tree-service.ts';
import { treeCommands } from './tree-commands.ts';

const entry = new RuntimeHandler((runtime) => treeCommands(new TreeService(runtime.db, runtime.storage)));

/** Lambda entry point for the content tree: categories, subcategories, folders and classes. */
export function handler(event: AppSyncResolverEvent): Promise<unknown> {
  return entry.handle(event);
}
