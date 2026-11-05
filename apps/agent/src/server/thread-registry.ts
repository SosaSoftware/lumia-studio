import type { Agent } from '@strands-agents/sdk';
import type { Caller } from '../identity/caller.ts';
import type { PendingFrontendCall } from '../interventions/frontend-call-ledger.ts';
import type { Logger } from '../shared/logger.ts';
import { actorKeyOf } from '../storage/state-keys.ts';

/** The agent of one conversation of one person. */
export interface ThreadAgent {
  readonly agent: Agent;
  /** Frontend calls of Lumi that the browser has not answered yet. */
  pendingFrontendCalls(): PendingFrontendCall[];
  /** Saves pending memory and closes the connections of the agent. */
  dispose(): Promise<void>;
}

/** Builds the agent of a conversation for a person, with the conversation restored from storage. */
export type ThreadAgentFactory = (request: { readonly caller: Caller; readonly threadId: string }) => Promise<ThreadAgent>;

/** A thread agent lent to one request; release it when the response ends. */
export interface ThreadLease {
  /** Thread id the adapter runs under: unique per person and conversation. */
  readonly threadKey: string;
  readonly thread: ThreadAgent;
  release(): void;
}

/** Raised when every slot holds a conversation that is in use. */
export class ThreadCapacityError extends Error {
  public constructor(limit: number) {
    super(`All ${String(limit)} conversation slots are in use.`);
    this.name = 'ThreadCapacityError';
  }
}

export interface ThreadRegistryOptions {
  /** Minutes without requests after which an agent is released; its conversation stays in storage. */
  readonly idleMinutes: number;
  /** Agents kept in memory at once. */
  readonly maxThreads: number;
  readonly now?: () => number;
}

interface Entry {
  readonly token: string;
  readonly thread: ThreadAgent;
  lastUsed: number;
  leases: number;
  disposed: boolean;
}

/**
 * Keeps one agent per person and conversation, in the map that `@ag-ui/aws-strands` reads (`agentsByThread`).
 *
 * The adapter keys that map by thread id, so the registry runs each conversation under a key that also names the
 * person: two people sending the same thread id get different agents, sessions and adapter state. An agent is
 * created on the first request, and created again when the token changes, because its MCP connection carries the
 * token; the session restores the conversation into the new agent. An agent lent to a request is never replaced
 * or evicted until the request ends, and concurrent requests for one conversation share a single creation.
 */
export class ThreadRegistry {
  /** Read by the adapter: thread key → agent. */
  public readonly agentsByThread = new Map<string, Agent>();
  private readonly entries = new Map<string, Entry>();
  private readonly creations = new Map<string, Promise<Entry>>();
  private readonly idleMs: number;
  private readonly now: () => number;
  private sweeper: NodeJS.Timeout | undefined;

  public constructor(
    private readonly factory: ThreadAgentFactory,
    private readonly logger: Logger,
    private readonly options: ThreadRegistryOptions,
  ) {
    this.idleMs = options.idleMinutes * 60_000;
    this.now = options.now ?? Date.now;
  }

  /** Thread id the adapter runs a conversation under. */
  public static threadKey(caller: Caller, threadId: string): string {
    return `${actorKeyOf(caller.sub)}.${threadId}`;
  }

  /** Whether some conversation is running, for the `HealthyBusy` status of `/ping`. */
  public get busy(): boolean {
    return [...this.entries.values()].some((entry) => entry.thread.agent.isInvoking);
  }

  /**
   * Lends the agent of a conversation to a request, creating it when needed.
   *
   * @throws ThreadCapacityError when every slot is in use.
   * @throws whatever the factory throws, such as an unauthenticated token or an unavailable MCP.
   */
  public async acquire(caller: Caller, threadId: string): Promise<ThreadLease> {
    const threadKey = ThreadRegistry.threadKey(caller, threadId);
    for (;;) {
      const creation = this.creations.get(threadKey);
      if (creation !== undefined) {
        // Whatever the outcome, the state is checked again: a failed creation is retried by this request.
        await creation.then(
          () => undefined,
          () => undefined,
        );
        continue;
      }
      const current = this.entries.get(threadKey);
      // A lent or running agent is kept: replacing it would cut the turn in progress, and the adapter refuses a
      // second run on the thread with THREAD_BUSY. The check and the lease happen in one synchronous step.
      if (current !== undefined && (current.token === caller.token || current.leases > 0 || current.thread.agent.isInvoking)) {
        return this.lend(threadKey, current);
      }
      const pending = this.create(threadKey, caller, threadId, current);
      this.creations.set(threadKey, pending);
      try {
        return this.lend(threadKey, await pending);
      } finally {
        this.creations.delete(threadKey);
      }
    }
  }

  /** Releases every agent, saving their pending memory; used when the server stops. */
  public async close(): Promise<void> {
    if (this.sweeper !== undefined) {
      clearInterval(this.sweeper);
      this.sweeper = undefined;
    }
    await Promise.allSettled(this.creations.values());
    const entries = [...this.entries.values()];
    this.entries.clear();
    this.agentsByThread.clear();
    await Promise.all(entries.map((entry) => this.dispose(entry)));
  }

  /** Releases agents that are not lent and have been idle longer than the limit. */
  public async evictIdle(): Promise<void> {
    const cutoff = this.now() - this.idleMs;
    const idle = [...this.entries].filter(([, entry]) => ThreadRegistry.evictable(entry) && entry.lastUsed <= cutoff);
    await Promise.all(idle.map(([threadKey, entry]) => this.remove(threadKey, entry, 'idle')));
  }

  private lend(threadKey: string, entry: Entry): ThreadLease {
    entry.leases += 1;
    entry.lastUsed = this.now();
    let released = false;
    return {
      threadKey,
      thread: entry.thread,
      release: () => {
        if (!released) {
          released = true;
          entry.leases -= 1;
          entry.lastUsed = this.now();
        }
      },
    };
  }

  private async create(threadKey: string, caller: Caller, threadId: string, previous: Entry | undefined): Promise<Entry> {
    if (previous === undefined) {
      await this.makeRoom();
    }
    const thread = await this.factory({ caller, threadId });
    const entry: Entry = { token: caller.token, thread, lastUsed: this.now(), leases: 0, disposed: false };
    this.entries.set(threadKey, entry);
    this.agentsByThread.set(threadKey, thread.agent);
    this.startSweeper();
    this.logger.info('Conversation agent ready', { threadKey, replaced: previous !== undefined });
    if (previous !== undefined) {
      await this.dispose(previous);
    }
    return entry;
  }

  /** Frees a slot when the registry is full: idle agents go first, then the least recently used one not in use. */
  private async makeRoom(): Promise<void> {
    // Creations in flight hold a slot too.
    const used = (): number => this.entries.size + this.creations.size;
    if (used() < this.options.maxThreads) {
      return;
    }
    await this.evictIdle();
    if (used() < this.options.maxThreads) {
      return;
    }
    const oldest = [...this.entries].filter(([, entry]) => ThreadRegistry.evictable(entry)).sort(([, a], [, b]) => a.lastUsed - b.lastUsed)[0];
    if (oldest === undefined) {
      throw new ThreadCapacityError(this.options.maxThreads);
    }
    await this.remove(oldest[0], oldest[1], 'capacity');
  }

  private static evictable(entry: Entry): boolean {
    return entry.leases === 0 && !entry.thread.agent.isInvoking;
  }

  private async remove(threadKey: string, entry: Entry, reason: string): Promise<void> {
    if (this.entries.get(threadKey) !== entry) {
      return;
    }
    this.entries.delete(threadKey);
    this.agentsByThread.delete(threadKey);
    this.logger.info('Conversation agent released', { threadKey, reason });
    await this.dispose(entry);
  }

  private startSweeper(): void {
    if (this.sweeper !== undefined) {
      return;
    }
    const period = Math.max(1_000, Math.min(this.idleMs, 60_000));
    this.sweeper = setInterval(() => {
      this.evictIdle().catch((error: unknown) => {
        this.logger.warn('Releasing idle conversations failed', { error });
      });
    }, period);
    // The sweeper alone must not keep the process alive.
    this.sweeper.unref();
  }

  private async dispose(entry: Entry): Promise<void> {
    if (entry.disposed) {
      return;
    }
    entry.disposed = true;
    try {
      await entry.thread.dispose();
    } catch (error) {
      this.logger.warn('Releasing a conversation agent failed', { error });
    }
  }
}
