/**
 * Stable names for the things the history refers to. Undoing a deletion creates the element again with a new id, and
 * a published class gets new ids for everything when it is edited; the history keeps the first name of each thing and
 * this map says which id that name has now.
 */
export class IdHandles {
  private readonly realByHandle = new Map<string, string>();
  private readonly handleByReal = new Map<string, string>();

  /** The name of the thing with this id; a thing seen for the first time is named after its id. */
  public handle(real: string): string {
    const existing = this.handleByReal.get(real);
    if (existing !== undefined) return existing;
    this.bind(real, real);
    return real;
  }

  /** The id a name has now; a name that was never bound is already an id. */
  public real(handle: string): string {
    return this.realByHandle.get(handle) ?? handle;
  }

  /** Says that `handle` now is the thing with id `real`. */
  public bind(handle: string, real: string): void {
    const previous = this.realByHandle.get(handle);
    if (previous !== undefined) this.handleByReal.delete(previous);
    this.realByHandle.set(handle, real);
    this.handleByReal.set(real, handle);
  }

  /** Follows ids that changed, as `[from, to]` pairs: the names of the old ids point to the new ones. */
  public remap(pairs: Iterable<readonly [string, string]>): void {
    for (const [from, to] of pairs) {
      const handle = this.handleByReal.get(from);
      if (handle !== undefined) this.bind(handle, to);
    }
  }

  public clear(): void {
    this.realByHandle.clear();
    this.handleByReal.clear();
  }
}
