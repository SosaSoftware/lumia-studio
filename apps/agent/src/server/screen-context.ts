import type { Context } from '@ag-ui/core';

export interface ScreenContextLimits {
  /** Entries kept; the web sends about eight. */
  readonly maxEntries: number;
  /** Characters kept of each value. */
  readonly maxValueChars: number;
}

const DEFAULT_LIMITS: ScreenContextLimits = { maxEntries: 16, maxValueChars: 600 };

/** Names the web gives to its entries: `page`, `record`, `selection`… */
const ENTRY_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;

/**
 * Prepares the screen state that the web sends with every run (open class, selection, panels) for the model.
 *
 * `@ag-ui/aws-strands` shows these entries to the model in each call, without saving them in the conversation, so
 * Lumi always sees the screen as it is now. The values carry text that people typed (class names, slide titles),
 * so they are reduced to compact JSON, angle brackets become `‹ ›` so no value can open or close a tag of the
 * prompt, and each value is cut to a bounded length.
 */
export class ScreenContext {
  public constructor(private readonly limits: ScreenContextLimits = DEFAULT_LIMITS) {}

  public sanitize(entries: readonly Context[]): Context[] {
    const byName = new Map<string, string>();
    for (const entry of entries) {
      const name = entry.description.trim();
      if (ENTRY_NAME.test(name)) {
        byName.delete(name);
        byName.set(name, this.value(entry.value));
      }
    }
    return [...byName].slice(-this.limits.maxEntries).map(([description, value]) => ({ description, value }));
  }

  private value(raw: string): string {
    let compact: string;
    try {
      compact = JSON.stringify(JSON.parse(raw));
    } catch {
      // Not JSON: the text itself is the value.
      compact = raw.replace(/\s+/g, ' ').trim();
    }
    const neutral = compact.replaceAll('<', '‹').replaceAll('>', '›');
    return neutral.length <= this.limits.maxValueChars ? neutral : `${neutral.slice(0, this.limits.maxValueChars)}…`;
  }
}
