import { SessionManager } from '@strands-agents/sdk';
import type { Storage } from '@strands-agents/sdk/storage';

/** Where one conversation of one person is kept. */
export interface Conversation {
  /** Id of the conversation in storage and memory: a hash of the thread id. */
  readonly sessionId: string;
  /** Storage of the person: the snapshots of their conversations and the context that Strands offloads. */
  readonly storage: Storage;
  /** Saves the conversation after every message and restores it when its agent is created again. */
  readonly session: SessionManager;
}

/** Strands agent id of Lumi; it is part of every snapshot path, so it must never change. */
export const LUMI_AGENT_ID = 'lumi';

/**
 * Opens conversations under the namespace of their person, so a thread id sent by someone else finds nothing.
 *
 * Layout: `<actorKey>/<sessionId>/scopes/agent/lumi/snapshots/` for the conversation and
 * `<actorKey>/context/<sessionId>/` for the large tool results that the context manager offloads.
 */
export class ConversationStore {
  /**
   * @param openStorage - Opens the root storage: an `S3Storage` in AWS, a `LocalFileStorage` locally. It is called
   *   for each conversation, so the AWS client is created while serving the session.
   */
  public constructor(private readonly openStorage: () => Storage) {}

  public open(actorKey: string, sessionId: string): Conversation {
    const root = this.openStorage();
    if (root.namespace === undefined) {
      throw new TypeError('The conversation storage must support namespaces.');
    }
    const storage = root.namespace(actorKey);
    return { sessionId, storage, session: new SessionManager({ sessionId, storage, saveLatestOn: 'message' }) };
  }
}
