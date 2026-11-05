import type { MemoryStore } from '@strands-agents/sdk';
import { createAgentCoreMemoryStores } from 'bedrock-agentcore/memory/strands';
import { LUMI_MEMORY_PREFERENCES_NAMESPACE } from '@lumia/packages/lumi-env';
import type { PreferenceMemory } from './preference-memory.ts';
import { PREFERENCES_DESCRIPTION, PREFERENCES_STORE } from './preference-memory.ts';

/**
 * Preferences kept in Amazon Bedrock AgentCore Memory, in AWS.
 *
 * Lumi writes the text of each conversation as events of the person (`actorId`); the user preference strategy of
 * the memory resource extracts the preferences into {@link LUMI_MEMORY_PREFERENCES_NAMESPACE}, where Lumi reads
 * them. Tool calls and their results are not written.
 */
export class AgentCorePreferenceMemory implements PreferenceMemory {
  public constructor(
    private readonly memoryId: string,
    private readonly region: string,
  ) {}

  public storesFor(actorKey: string, sessionId: string): MemoryStore[] {
    return createAgentCoreMemoryStores({
      memoryId: this.memoryId,
      actorId: actorKey,
      sessionId,
      region: this.region,
      namespaces: [{ namespace: LUMI_MEMORY_PREFERENCES_NAMESPACE, name: PREFERENCES_STORE, description: PREFERENCES_DESCRIPTION, writable: true }],
      extraction: true,
    });
  }
}
