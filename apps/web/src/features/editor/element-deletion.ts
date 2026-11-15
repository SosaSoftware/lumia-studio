import { reactive } from 'vue';
import type { Slide } from '../../api/types.ts';
import { activeCustomButton, activeStartButton } from '../slides/slide-buttons.ts';

/** How a slide relies on a button: as its start button, or as the custom button that replaces the lateral Next. */
export interface ButtonLink {
  readonly kind: 'start' | 'custom';
  readonly name: string;
  readonly slideNumber: number;
}

/** Links of the elements `ids` to the slides that use them right now as start or custom button. */
export function buttonLinks(slides: readonly Slide[], ids: readonly string[]): ButtonLink[] {
  const links: ButtonLink[] = [];
  for (const slide of slides) {
    const start = activeStartButton(slide);
    if (start !== null && ids.includes(start.id)) links.push({ kind: 'start', name: start.name, slideNumber: slide.position });
    const custom = activeCustomButton(slide);
    if (custom !== null && ids.includes(custom.id)) links.push({ kind: 'custom', name: custom.name, slideNumber: slide.position });
  }
  return links;
}

/**
 * Asks before deleting a button that a slide relies on, and tells where it is linked. Every way of deleting elements
 * (Properties, the canvas, cut) goes through it; elements without links are deleted at once.
 */
export class ElementDeletionGate {
  public readonly state = reactive<{ links: ButtonLink[] }>({ links: [] });
  private pending: (() => void) | null = null;

  /** Runs `remove` now, or after the person confirms when one of the elements is a linked button. */
  public request(slides: readonly Slide[], ids: readonly string[], remove: () => void): void {
    const links = buttonLinks(slides, ids);
    if (links.length === 0) {
      remove();
      return;
    }
    this.pending = remove;
    this.state.links = links;
  }

  public confirm(): void {
    const remove = this.pending;
    this.cancel();
    remove?.();
  }

  public cancel(): void {
    this.pending = null;
    this.state.links = [];
  }
}

/** The gate of the open workspace. */
export const elementDeletion = new ElementDeletionGate();
