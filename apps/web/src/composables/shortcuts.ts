/**
 * Keyboard shortcuts of the app. A shortcut is data: its keys, when it applies and what it runs. Adding a command is
 * adding one entry to a list that is registered in a `ShortcutRegistry`; the registry owns the key matching, the
 * Mac/Windows difference and the rule that text fields keep their keys.
 */

/** A command bound to one or more key combinations. `C` is what the command needs to do its work. */
export interface Shortcut<C> {
  /** Name of the command, unique in its list; it identifies the shortcut when a help list or a test refers to it. */
  readonly id: string;
  /**
   * Key combinations that run it, such as `'mod+c'` or `'mod+shift+z'`. `mod` is Cmd on macOS and Ctrl elsewhere;
   * `ctrl`, `meta`, `shift` and `alt` are exact. The last part is the key (`'a'`, `'Delete'`, `'ArrowLeft'`).
   */
  readonly keys: readonly string[];
  /** Whether the command applies now. When it does not, the key keeps its usual meaning in the browser. */
  readonly when?: (context: C) => boolean;
  readonly run: (context: C) => void;
  /** Runs also while the focus is in a text field. Off by default, so copying and pasting text keeps working. */
  readonly inFields?: boolean;
}

interface Combo {
  readonly key: string;
  readonly mod: boolean;
  readonly ctrl: boolean;
  readonly meta: boolean;
  readonly shift: boolean;
  readonly alt: boolean;
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

/** Reads a combination such as `'mod+shift+z'`. */
export function parseCombo(text: string): Combo {
  const parts = text.toLowerCase().split('+');
  const key = parts.pop() ?? '';
  return { key, mod: parts.includes('mod'), ctrl: parts.includes('ctrl'), meta: parts.includes('meta'), shift: parts.includes('shift'), alt: parts.includes('alt') };
}

/** True when the key press is exactly that combination: no modifier more and none less. */
export function matchesCombo(combo: Combo, event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>): boolean {
  if (event.key.toLowerCase() !== combo.key) return false;
  const wantsMeta = combo.meta || (combo.mod && IS_MAC);
  const wantsCtrl = combo.ctrl || (combo.mod && !IS_MAC);
  return event.metaKey === wantsMeta && event.ctrlKey === wantsCtrl && event.shiftKey === combo.shift && event.altKey === combo.alt;
}

/** True when the key press comes from a place where keys mean text: a field, or a dialog that has its own keys. */
export function isTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="dialog"], [aria-modal="true"]') !== null;
}

/** True when the person has selected some text on the page, so copying should copy it. */
export function hasTextSelection(): boolean {
  return (window.getSelection()?.toString() ?? '') !== '';
}

interface Entry<C> {
  readonly shortcut: Shortcut<C>;
  readonly combos: readonly Combo[];
}

/** Finds the shortcut that matches a key press and runs it. */
export class ShortcutRegistry<C> {
  private readonly entries: Entry<C>[] = [];

  /**
   * @param context Gives the command what it needs at the moment of the key press.
   * @param enabled Turns every shortcut off while it returns false, for example while a full-screen preview has its own keys.
   */
  public constructor(
    private readonly context: () => C,
    private readonly enabled: () => boolean = () => true,
  ) {}

  /** Adds shortcuts. When two share a combination the first one whose `when` allows it runs, so the order is the priority. */
  public register(shortcuts: readonly Shortcut<C>[]): void {
    for (const shortcut of shortcuts) this.entries.push({ shortcut, combos: shortcut.keys.map(parseCombo) });
  }

  /** Runs the shortcut for a key press and cancels the browser's own action; returns whether one ran. */
  public handle(event: KeyboardEvent): boolean {
    if (event.defaultPrevented || event.isComposing || event.repeat || !this.enabled()) return false;
    for (const { shortcut, combos } of this.entries) {
      if (!combos.some((combo) => matchesCombo(combo, event))) continue;
      if (shortcut.inFields !== true && isTextTarget(event.target)) continue;
      const context = this.context();
      if (shortcut.when !== undefined && !shortcut.when(context)) continue;
      event.preventDefault();
      shortcut.run(context);
      return true;
    }
    return false;
  }

  /** Starts listening to the key presses of the window; returns the function that stops it. */
  public attach(target: Window = window): () => void {
    const listener = (event: KeyboardEvent): void => {
      this.handle(event);
    };
    target.addEventListener('keydown', listener);
    return () => {
      target.removeEventListener('keydown', listener);
    };
  }
}
