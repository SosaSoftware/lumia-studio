import { createDatabase } from '../infrastructure/db/index.ts';
import type { Database } from '../infrastructure/db/index.ts';
import { createSpeechSynthesizer } from '../infrastructure/speech/index.ts';
import type { SpeechSynthesizer } from '../infrastructure/speech/index.ts';
import { createObjectStorage } from '../infrastructure/storage/index.ts';
import type { ObjectStorage } from '../infrastructure/storage/index.ts';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { LambdaExportQueue, NO_EXPORTS } from '../services/export-queue.ts';
import type { ExportQueue } from '../services/export-queue.ts';
import { Config, ProcessEnvSource } from '../shared/config/index.ts';
import { Logger } from '../shared/log/index.ts';

/** Dependencies shared by the Studio handlers; a Lambda builds them once from its configuration. */
export class StudioRuntime {
  private static shared: StudioRuntime | undefined;

  public constructor(
    public readonly db: Database,
    public readonly storage: ObjectStorage,
    public readonly speech: SpeechSynthesizer,
    public readonly logger: Logger,
    /** Starts the export of published classes; only AWS exports them. */
    public readonly exports: ExportQueue = NO_EXPORTS,
  ) {}

  /** Builds the dependencies from environment variables, SSM or Secrets Manager (see `.env.example`). */
  public static fromConfig(config: Config = new Config(new ProcessEnvSource())): StudioRuntime {
    return new StudioRuntime(
      createDatabase('studio_app', config),
      createObjectStorage(config),
      createSpeechSynthesizer(config),
      new Logger({ service: 'lumia-studio' }),
      StudioRuntime.exportsFrom(config),
    );
  }

  /** `LUMIA_EXPORT_FUNCTION` names the export Lambda in AWS; without it published classes are not exported. */
  private static exportsFrom(config: Config): ExportQueue {
    const functionName = config.optional('LUMIA_EXPORT_FUNCTION', '');
    return functionName === '' ? NO_EXPORTS : new LambdaExportQueue(new LambdaClient({}), functionName);
  }

  /** The runtime handlers use: the one set with `use`, otherwise built from the configuration on first call. */
  public static current(): StudioRuntime {
    StudioRuntime.shared ??= StudioRuntime.fromConfig();
    return StudioRuntime.shared;
  }

  /** Replaces the shared runtime (tests and the sandbox inject their own); `undefined` restores the default. */
  public static use(runtime: StudioRuntime | undefined): void {
    StudioRuntime.shared = runtime;
  }
}
