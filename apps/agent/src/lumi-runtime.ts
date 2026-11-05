import { configureLogging } from '@strands-agents/sdk';
import { LocalFileStorage, S3Storage } from '@strands-agents/sdk/storage';
import type { Storage } from '@strands-agents/sdk/storage';
import type { LumiEnv } from '@lumia/packages/lumi-env';
import type { IdentityResolver } from './identity/caller.ts';
import { LumiAgentFactory, OPEN_TARGETS } from './lumi.agent.ts';
import { LumiAssets } from './lumi-assets.ts';
import { StudioMcpConnector } from './mcp/studio-mcp-connector.ts';
import { AgentCorePreferenceMemory } from './memory/agentcore-preference-memory.ts';
import { FilePreferenceMemory } from './memory/file-preference-memory.ts';
import type { PreferenceMemory } from './memory/preference-memory.ts';
import { BedrockModelFactory } from './model/bedrock-model-factory.ts';
import { AguiServer } from './server/agui-server.ts';
import { InputGuard } from './server/input-guard.ts';
import { ScreenContext } from './server/screen-context.ts';
import { ThreadRegistry } from './server/thread-registry.ts';
import { LibraryLogBridge } from './shared/library-log-bridge.ts';
import type { Logger } from './shared/logger.ts';
import { ConversationStore } from './storage/conversation-store.ts';

/** Conversations kept in memory at once; AgentCore runs one session per microVM, a local process several. */
const MAX_THREADS = 100;

export interface LumiRuntimeOptions {
  /** Settings, already parsed by the entry point. */
  readonly env: LumiEnv;
  /** Root of the `@lumia/agent` package: it holds `src/prompts`, `skills` and `policies`. */
  readonly appRoot: string;
  /** How the bearer token of each request becomes the person. */
  readonly identity: IdentityResolver;
  readonly logger: Logger;
}

/**
 * Wires Lumi from its settings and serves it: model, Studio MCP, conversations, preferences, the agent factory, the
 * registry of conversations and the AG-UI server. Both entry points use it; they differ only in how they read the
 * environment and resolve identities.
 */
export class LumiRuntime {
  private constructor(
    private readonly server: AguiServer,
    /** Port the server listens on. */
    public readonly port: number,
    private readonly logger: Logger,
  ) {}

  /** Loads the assets, builds every part and starts listening. */
  public static async start(options: LumiRuntimeOptions): Promise<LumiRuntime> {
    const { env, logger } = options;
    configureLogging(new LibraryLogBridge(logger.child({ component: 'strands' })));
    const assets = await LumiAssets.load(options.appRoot);
    const factory = new LumiAgentFactory({
      assets,
      models: new BedrockModelFactory(env.model, env.region),
      studio: new StudioMcpConnector({ url: env.mcp.url, tokenHeader: env.mcp.tokenHeader, openTargets: OPEN_TARGETS, logger: logger.child({ component: 'studio-mcp' }) }),
      conversations: new ConversationStore(LumiRuntime.storageOpener(env)),
      memory: LumiRuntime.preferenceMemory(env, assets),
      logger,
    });
    const registry = new ThreadRegistry((request) => factory.create(request), logger.child({ component: 'threads' }), {
      idleMinutes: env.threadIdleMinutes,
      maxThreads: MAX_THREADS,
    });
    const server = new AguiServer({
      name: 'lumi',
      description: 'Lumi, the co-creation agent of Lumia Studio.',
      identity: options.identity,
      registry,
      guard: new InputGuard(new ScreenContext()),
      logger,
    });
    const port = await server.listen(env.port, env.bindHost);
    logger.info('Lumi is listening', { host: env.bindHost, port, model: env.model.id, sessions: env.session.kind, memory: env.memory.kind });
    return new LumiRuntime(server, port, logger);
  }

  /** Stops on SIGINT and SIGTERM after the running turns finish, saving pending memory. */
  public stopOnSignals(): void {
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.once(signal, () => {
        this.logger.info('Stopping Lumi', { signal });
        this.close().then(
          () => process.exit(0),
          (error: unknown) => {
            this.logger.error('Lumi did not stop cleanly', { error });
            process.exit(1);
          },
        );
      });
    }
  }

  public close(): Promise<void> {
    return this.server.close();
  }

  private static storageOpener(env: LumiEnv): () => Storage {
    const session = env.session;
    if (session.kind === 's3') {
      return () => new S3Storage(session.bucket, { prefix: session.prefix, region: env.region });
    }
    return () => new LocalFileStorage(session.dir);
  }

  private static preferenceMemory(env: LumiEnv, assets: LumiAssets): PreferenceMemory {
    const memory = env.memory;
    return memory.kind === 'agentcore' ? new AgentCorePreferenceMemory(memory.memoryId, env.region) : new FilePreferenceMemory(memory.dir, assets.preferenceExtraction);
  }
}
