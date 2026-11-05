import { createHarness } from '@strands-agents/harness';
import { AgentSkills } from '@strands-agents/sdk/vended-plugins/skills';
import type { Caller } from './identity/caller.ts';
import { ConfirmationGate } from './interventions/confirmation-gate.ts';
import { FrontendCallLedger } from './interventions/frontend-call-ledger.ts';
import { UnfinishedTurnCloser } from './interventions/unfinished-turn-closer.ts';
import type { LumiAssets } from './lumi-assets.ts';
import type { StudioToolSource } from './mcp/studio-mcp-connector.ts';
import type { PreferenceMemory } from './memory/preference-memory.ts';
import type { ModelProvider } from './model/bedrock-model-factory.ts';
import type { ThreadAgent } from './server/thread-registry.ts';
import type { Logger } from './shared/logger.ts';
import type { ConversationStore } from './storage/conversation-store.ts';
import { LUMI_AGENT_ID } from './storage/conversation-store.ts';
import { actorKeyOf, sessionIdOf } from './storage/state-keys.ts';

/** Gateway targets that every person sees, besides the Studio tools that `get_my_access` lists. */
export const OPEN_TARGETS: readonly string[] = ['knowledge'];

export interface LumiAgentDependencies {
  readonly assets: LumiAssets;
  readonly models: ModelProvider;
  readonly studio: StudioToolSource;
  readonly conversations: ConversationStore;
  readonly memory: PreferenceMemory;
  readonly logger: Logger;
}

/**
 * Lumi, the co-creation agent of Lumia Studio, built with the Strands harness.
 *
 * Each conversation of each person gets its own agent:
 * - the harness contract plus Lumi's instructions, and the co-creation skills, loaded on demand;
 * - the Studio tools the person may use, reached through the MCP with their own token, and the frontend tools that
 *   the web declares on each request (added by the AG-UI adapter);
 * - `todo_write` to track multi-step work, `search_memory` over the person's preferences and the context manager;
 *   no shell, file, web or sub-agent tools, and no background tasks;
 * - the {@link ConfirmationGate}, so no change runs without the consent of the person, and the
 *   {@link UnfinishedTurnCloser}, so a turn that ended without a reply does not break the next one;
 * - a session that saves the conversation after every message, so any process can resume it.
 */
export class LumiAgentFactory {
  public constructor(private readonly deps: LumiAgentDependencies) {}

  /**
   * Builds the agent of one conversation and restores its saved state.
   *
   * @throws UnauthenticatedError or StudioUnavailableError from the Studio MCP.
   */
  public async create(request: { readonly caller: Caller; readonly threadId: string }): Promise<ThreadAgent> {
    const { assets, logger } = this.deps;
    const actorKey = actorKeyOf(request.caller.sub);
    const conversation = this.deps.conversations.open(actorKey, sessionIdOf(request.threadId));
    const studio = await this.deps.studio.connect(request.caller.token);
    try {
      const ledger = new FrontendCallLedger();
      const stores = this.deps.memory.storesFor(actorKey, conversation.sessionId);
      const agent = await createHarness({
        id: LUMI_AGENT_ID,
        name: 'Lumi',
        description: 'Co-creation agent of Lumia Studio.',
        model: this.deps.models.create(),
        instructions: assets.instructions,
        tools: [...studio.tools],
        plugins: [ledger, new UnfinishedTurnCloser()],
        skills: new AgentSkills({ skills: [...assets.skills], strict: true }),
        // Without stores the harness would create its default store in the working directory.
        memory: stores.length > 0 ? { stores } : false,
        session: conversation.session,
        storage: conversation.storage,
        builtinTools: [],
        builtinPlugins: ['todos'],
        backgroundTasks: false,
        contextManager: 'auto',
        interventions: [new ConfirmationGate(assets.confirmationPolicy, logger.child({ component: 'confirmation-gate', actorKey }))],
        printer: false,
      });
      // The adapter reads the conversation before the first run, so the session must be restored first.
      await agent.initialize();
      return {
        agent,
        pendingFrontendCalls: () => ledger.pending(),
        dispose: async () => {
          try {
            await agent.shutdown();
          } finally {
            await studio.close();
          }
        },
      };
    } catch (error) {
      await studio.close().catch((closeError: unknown) => {
        logger.warn('Closing the Studio MCP connection failed', { error: closeError });
      });
      throw error;
    }
  }
}
