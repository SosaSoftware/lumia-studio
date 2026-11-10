import { reactive } from 'vue';

/** Time in which two changes of the same thing count as one gesture: a drag, typing in a field, a row of key presses. */
export const MERGE_WINDOW_MS = 700;

/** Most steps the history keeps. */
export const HISTORY_LIMIT = 100;

/** One step of the history: what it does and what undoes it. */
export interface UndoEntry {
  /** When the step happened, in milliseconds. */
  readonly at: number;
  undo(): Promise<void>;
  redo(): Promise<void>;
  /** Joins a later step to this one when both are one gesture; null when they are not. */
  merge(later: UndoEntry): UndoEntry | null;
}

/** An edit of some fields of one thing: undoing it puts the fields back, redoing it sets them again. */
export class PatchEntry<P extends object> implements UndoEntry {
  /**
   * @param group Kind of thing edited, so only edits of the same kind join.
   * @param target Name of the thing edited.
   * @param before Values the fields had.
   * @param after Values the fields were given.
   * @param apply Sets the fields of the thing.
   */
  public constructor(
    private readonly group: string,
    private readonly target: string,
    private readonly before: P,
    private readonly after: P,
    private readonly apply: (target: string, patch: P) => Promise<void>,
    public readonly at: number = Date.now(),
  ) {}

  public undo(): Promise<void> {
    return this.apply(this.target, this.before);
  }

  public redo(): Promise<void> {
    return this.apply(this.target, this.after);
  }

  public merge(later: UndoEntry): UndoEntry | null {
    if (!(later instanceof PatchEntry) || later.group !== this.group || later.target !== this.target || later.at - this.at > MERGE_WINDOW_MS) return null;
    // The same group is the same kind of patch, so the later one has the shape of this one.
    const next = later as PatchEntry<P>;
    // The earliest values before and the latest ones after: both edits read as one.
    return new PatchEntry(this.group, this.target, { ...next.before, ...this.before }, { ...this.after, ...next.after }, this.apply, later.at);
  }
}

/** Several steps that happened together, such as moving a group of elements; they are undone as one. */
export class CompositeEntry implements UndoEntry {
  public constructor(
    private readonly entries: readonly UndoEntry[],
    /** Runs after the steps, for example to select what changed. */
    private readonly done: () => void = () => undefined,
    public readonly at: number = Date.now(),
  ) {}

  public async undo(): Promise<void> {
    for (const entry of [...this.entries].reverse()) await entry.undo();
    this.done();
  }

  public async redo(): Promise<void> {
    for (const entry of this.entries) await entry.redo();
    this.done();
  }

  public merge(later: UndoEntry): UndoEntry | null {
    if (!(later instanceof CompositeEntry) || later.entries.length !== this.entries.length || later.at - this.at > MERGE_WINDOW_MS) return null;
    const merged: UndoEntry[] = [];
    for (const [index, entry] of this.entries.entries()) {
      const next = later.entries[index];
      const joined = next === undefined ? null : entry.merge(next);
      if (joined === null) return null;
      merged.push(joined);
    }
    return new CompositeEntry(merged, this.done, later.at);
  }
}

/** A step made of two actions that cancel each other, such as creating an element and deleting it. */
export class ActionEntry implements UndoEntry {
  public constructor(
    private readonly onUndo: () => Promise<void>,
    private readonly onRedo: () => Promise<void>,
    public readonly at: number = Date.now(),
  ) {}

  public undo(): Promise<void> {
    return this.onUndo();
  }

  public redo(): Promise<void> {
    return this.onRedo();
  }

  public merge(): UndoEntry | null {
    return null;
  }
}

/** The steps that can be undone and, once undone, redone. */
export class UndoHistory {
  /** What the interface needs to enable its controls. */
  public readonly state = reactive({ canUndo: false, canRedo: false });
  private done: UndoEntry[] = [];
  private undone: UndoEntry[] = [];
  private replaying = false;
  /** Undos and redos asked while another one runs wait for it, so a fast row of key presses undoes one step each. */
  private queue: Promise<unknown> = Promise.resolve();

  /** False while a step is being undone or redone: the edits it makes are not new steps. */
  public get recording(): boolean {
    return !this.replaying;
  }

  /** Adds a step. A new step ends the redo line, and a step of the same gesture as the last one joins it. */
  public record(entry: UndoEntry): void {
    if (this.replaying) return;
    this.undone = [];
    const last = this.done[this.done.length - 1];
    const merged = last === undefined ? null : last.merge(entry);
    if (merged === null) {
      this.done.push(entry);
      if (this.done.length > HISTORY_LIMIT) this.done.shift();
    } else {
      this.done[this.done.length - 1] = merged;
    }
    this.sync();
  }

  /** Undoes the last step; false when there is none. */
  public undo(): Promise<boolean> {
    return this.enqueue(() => this.replay(this.done, this.undone, (entry) => entry.undo()));
  }

  /** Does again the last step that was undone. */
  public redo(): Promise<boolean> {
    return this.enqueue(() => this.replay(this.undone, this.done, (entry) => entry.redo()));
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task);
    // A failed step does not stop the ones that come after it.
    this.queue = result.catch(() => undefined);
    return result;
  }

  /** Forgets every step, for example when the class changes under the history. */
  public clear(): void {
    this.done = [];
    this.undone = [];
    this.sync();
  }

  private async replay(from: UndoEntry[], to: UndoEntry[], run: (entry: UndoEntry) => Promise<void>): Promise<boolean> {
    const entry = from.pop();
    if (entry === undefined) return false;
    this.replaying = true;
    try {
      await run(entry);
      to.push(entry);
      return true;
    } catch (error) {
      // A step that failed halfway leaves the class in an unknown state, so the steps no longer apply.
      this.clear();
      throw error;
    } finally {
      this.replaying = false;
      this.sync();
    }
  }

  private sync(): void {
    this.state.canUndo = this.done.length > 0;
    this.state.canRedo = this.undone.length > 0;
  }
}
