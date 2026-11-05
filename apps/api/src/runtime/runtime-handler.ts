import type { AppSyncResolverEvent } from '../graphql/appsync/index.ts';
import { FieldDispatcher } from '../graphql/appsync/index.ts';
import type { FieldCommand } from '../graphql/appsync/index.ts';
import { StudioRuntime } from './studio-runtime.ts';

/** Builds the field commands of one handler from the shared runtime. */
export type CommandFactory = (runtime: StudioRuntime) => Map<string, FieldCommand>;

/** Entry point of a handler: creates its dispatcher on first use and again whenever the runtime changes. */
export class RuntimeHandler {
  private cached: { runtime: StudioRuntime; dispatcher: FieldDispatcher } | undefined;

  public constructor(private readonly factory: CommandFactory) {}

  public handle(event: AppSyncResolverEvent): Promise<unknown> {
    const runtime = StudioRuntime.current();
    if (this.cached?.runtime !== runtime) {
      this.cached = { runtime, dispatcher: new FieldDispatcher(this.factory(runtime), runtime.logger) };
    }
    return this.cached.dispatcher.dispatch(event);
  }
}
