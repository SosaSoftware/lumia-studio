import type { MemoryStore } from '@strands-agents/sdk';
import { LocalFileStorage } from '@strands-agents/sdk/storage';
import { FileMemoryStore } from '@strands-agents/sdk/vended-memory-stores/file-memory-store';
import type { PreferenceMemory } from './preference-memory.ts';
import { PREFERENCES_DESCRIPTION, PREFERENCES_STORE } from './preference-memory.ts';

/**
 * Preferences kept as markdown files, one directory per person (`<dir>/<actorKey>/`), for local runs.
 * The agent's model distills them from the conversation in the background.
 */
export class FilePreferenceMemory implements PreferenceMemory {
  /**
   * @param dir - Root directory of the preferences.
   * @param extractionPrompt - What counts as a lasting preference, for the extractor.
   */
  public constructor(
    private readonly dir: string,
    private readonly extractionPrompt: string,
  ) {}

  public storesFor(actorKey: string): MemoryStore[] {
    return [
      new FileMemoryStore({
        name: PREFERENCES_STORE,
        description: PREFERENCES_DESCRIPTION,
        // A namespaced storage is used as is, so the files of the person sit directly under their key.
        storage: new LocalFileStorage(this.dir).namespace(actorKey),
        extraction: { systemPrompt: this.extractionPrompt },
      }),
    ];
  }
}
