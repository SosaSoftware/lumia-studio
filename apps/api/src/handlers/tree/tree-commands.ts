import type { FieldCommand } from '../../graphql/appsync/index.ts';
import type { PageRequest, TreeService } from '../../services/tree-service.ts';
import { commandMap } from '../../support/function-command.ts';
import type { InputReader } from '../../support/input-reader.ts';

function pageRequest(page: InputReader | undefined): PageRequest {
  const limit = page?.optionalInteger('limit');
  const nextToken = page?.optionalString('nextToken');
  return { ...(limit === undefined ? {} : { limit }), ...(nextToken === undefined ? {} : { nextToken }) };
}

/** Maps each field of the `tree` handler to the service call that resolves it. */
export function treeCommands(tree: TreeService): Map<string, FieldCommand> {
  return commandMap({
    'Query.me': (call) => tree.me(call.claims),
    'Query.categories': (call) => tree.categories(call.claims, pageRequest(call.args.optionalObject('page'))),
    'Query.treeNodes': (call) => tree.treeNodes(call.args.object('filter').id('subcategoryId'), pageRequest(call.args.optionalObject('page'))),
  });
}
