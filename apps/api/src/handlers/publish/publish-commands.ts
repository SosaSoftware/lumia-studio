import type { FieldCommand } from '../../graphql/appsync/index.ts';
import type { PublishService } from '../../services/publish-service.ts';
import { commandMap } from '../../support/function-command.ts';

/** Maps each field of the `publish` handler to the service call that resolves it. */
export function publishCommands(publish: PublishService): Map<string, FieldCommand> {
  return commandMap({
    'Mutation.publishVersion': (call) => publish.publish(call.claims, call.args.id('documentId')),
  });
}
