import type { MemoryStore } from '@strands-agents/sdk';

/** Name of the memory store with the preferences of the person. */
export const PREFERENCES_STORE = 'preferences';

/** What the store holds, as the model reads it in the description of `search_memory`. */
export const PREFERENCES_DESCRIPTION =
  'Lasting preferences of this person about how they create classes in Lumia Studio: tone, language, structure, formats and voices.';

/** Long-term memory of each person: what Lumi learns about how they like to work. */
export interface PreferenceMemory {
  /**
   * The memory stores of one person in one conversation.
   *
   * @param actorKey - Key of the person (`actorKeyOf`); memory never crosses people.
   * @param sessionId - Id of the conversation the new turns come from.
   */
  storesFor(actorKey: string, sessionId: string): MemoryStore[];
}
