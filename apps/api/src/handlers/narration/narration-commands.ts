import type { FieldCommand } from '../../graphql/appsync/index.ts';
import type { GenerateNarrationRequest, NarrationService } from '../../services/narration-service.ts';
import type { InputReader } from '../../support/input-reader.ts';
import { commandMap } from '../../support/function-command.ts';

function narrationRequest(input: InputReader): GenerateNarrationRequest {
  const id = input.optionalId('id');
  return {
    ...(id === undefined ? {} : { id }),
    slideId: input.id('slideId'),
    script: input.string('script'),
    startsAtS: input.number('startsAtS'),
    voice: input.optionalString('voice') ?? null,
    speed: input.number('speed'),
  };
}

/** Maps each field of the `narration` handler to the service call that resolves it. */
export function narrationCommands(narration: NarrationService): Map<string, FieldCommand> {
  return commandMap({
    'Query.narrationVoices': (call) => {
      const languageCode = call.args.optionalObject('filter')?.optionalString('languageCode');
      const page = call.args.optionalObject('page');
      const limit = page?.optionalInteger('limit');
      const nextToken = page?.optionalString('nextToken');
      return narration.voices({
        ...(languageCode === undefined ? {} : { languageCode }),
        ...(limit === undefined ? {} : { limit }),
        ...(nextToken === undefined ? {} : { nextToken }),
      });
    },
    'Mutation.generateNarration': (call) => narration.generate(call.claims, narrationRequest(call.args.object('input'))),
    'Mutation.saveNarration': (call) => narration.save(call.claims, narrationRequest(call.args.object('input'))),
    'Mutation.deleteNarration': (call) => narration.delete(call.claims, call.args.id('narrationClipId')),
  });
}
