/** Debounced saves by key: the last task scheduled for a key wins. */
export class SaveScheduler {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly tasks = new Map<string, () => Promise<void>>();
  private readonly running = new Set<Promise<void>>();

  public constructor(
    private readonly delayMs: number,
    private readonly onChange: () => void = () => undefined,
  ) {}

  /** Number of saves waiting or in flight. */
  public get pending(): number {
    return this.tasks.size + this.running.size;
  }

  public has(key: string): boolean {
    return this.tasks.has(key);
  }

  public schedule(key: string, task: () => Promise<void>): void {
    const timer = this.timers.get(key);
    if (timer !== undefined) clearTimeout(timer);
    this.tasks.set(key, task);
    this.timers.set(
      key,
      setTimeout(() => {
        this.run(key);
      }, this.delayMs),
    );
    this.onChange();
  }

  /** Drops the pending save of a key, e.g. because its target was deleted. */
  public cancel(key: string): void {
    const timer = this.timers.get(key);
    if (timer !== undefined) clearTimeout(timer);
    this.timers.delete(key);
    this.tasks.delete(key);
    this.onChange();
  }

  /** Runs every pending save now and waits for all saves in flight. */
  public async flush(): Promise<void> {
    for (const key of [...this.tasks.keys()]) this.run(key);
    await Promise.all([...this.running]);
  }

  private run(key: string): void {
    const task = this.tasks.get(key);
    const timer = this.timers.get(key);
    if (timer !== undefined) clearTimeout(timer);
    this.timers.delete(key);
    this.tasks.delete(key);
    if (task === undefined) return;
    const promise = task().finally(() => {
      this.running.delete(promise);
      this.onChange();
    });
    this.running.add(promise);
    this.onChange();
  }
}
