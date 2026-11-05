import { AppError } from '../../shared/errors/index.ts';
import type { Logger } from '../../shared/log/index.ts';
import type { AppSyncResolverEvent } from './appsync-event.ts';
import type { FieldCommand } from './field-command.ts';

/** Routes an event to the command registered for `<Type>.<field>`. */
export class FieldDispatcher {
  public constructor(
    private readonly commands: ReadonlyMap<string, FieldCommand>,
    private readonly logger?: Logger,
  ) {}

  public async dispatch(event: AppSyncResolverEvent): Promise<unknown> {
    const key = `${event.info.parentTypeName}.${event.info.fieldName}`;
    const command = this.commands.get(key);
    if (command === undefined) {
      throw AppError.internal('Operación no disponible.');
    }
    try {
      return await command.execute(event);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger?.error('Unhandled error in field command', { field: key, error });
      throw AppError.internal('Ocurrió un error interno.');
    }
  }
}
