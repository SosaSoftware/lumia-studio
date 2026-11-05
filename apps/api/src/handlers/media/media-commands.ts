import type { FieldCommand } from '../../graphql/appsync/index.ts';
import type { MediaService } from '../../services/media-service.ts';
import { commandMap } from '../../support/function-command.ts';

/** Maps each field of the `media` handler to the service call that resolves it. */
export function mediaCommands(media: MediaService): Map<string, FieldCommand> {
  return commandMap({
    'Query.mediaLibrary': (call) => {
      const filter = call.args.object('filter');
      const page = call.args.optionalObject('page');
      const mimePrefix = filter.optionalString('mimePrefix');
      const text = filter.optionalString('text');
      const limit = page?.optionalInteger('limit');
      const nextToken = page?.optionalString('nextToken');
      return media.library({
        categoryId: filter.id('categoryId'),
        ...(mimePrefix === undefined ? {} : { mimePrefix }),
        ...(text === undefined ? {} : { text }),
        ...(limit === undefined ? {} : { limit }),
        ...(nextToken === undefined ? {} : { nextToken }),
      });
    },
    'Mutation.createMediaUpload': (call) => {
      const input = call.args.object('input');
      return media.createUpload({
        categoryId: input.id('categoryId'),
        name: input.string('name'),
        mimeType: input.string('mimeType'),
        sizeBytes: input.number('sizeBytes'),
      });
    },
    'Mutation.registerMedia': (call) => {
      const input = call.args.object('input');
      return media.register(call.claims, {
        categoryId: input.id('categoryId'),
        key: input.string('key'),
        name: input.string('name'),
        mimeType: input.string('mimeType'),
        sizeBytes: input.number('sizeBytes'),
      });
    },
  });
}
