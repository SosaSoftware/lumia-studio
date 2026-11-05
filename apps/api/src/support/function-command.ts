import type { AppSyncResolverEvent, FieldCommand } from '../graphql/appsync/index.ts';
import { StudioCall } from './studio-call.ts';

/** Command that runs one service method with the parsed call. */
export class FunctionCommand implements FieldCommand {
  public constructor(private readonly run: (call: StudioCall) => Promise<unknown>) {}

  public execute(event: AppSyncResolverEvent): Promise<unknown> {
    return this.run(StudioCall.from(event));
  }
}

/** Builds the `Type.field` command map a `FieldDispatcher` takes. */
export function commandMap(entries: Record<string, (call: StudioCall) => Promise<unknown>>): Map<string, FieldCommand> {
  return new Map(Object.entries(entries).map(([key, run]) => [key, new FunctionCommand(run)]));
}
