import { inject, provide } from 'vue';
import type { InjectionKey } from 'vue';
import type { MediaRef, SlideElement } from '../../api/types.ts';

/** Navigation that the student preview offers to components such as `button_link`. */
export interface SlideNavigator {
  next(): void;
  /** Goes to a slide by its 1-based position. */
  goTo(position: number): void;
}

/** Collects which questions of the slide are completed; the preview uses it for the "Al completar" advance. */
export interface QuestionTracker {
  /** `done` is true once the question is answered correctly or runs out of attempts. */
  report(elementId: string, done: boolean): void;
}

/** What a catalog component may know about the slide it is drawn on. */
export interface SlideContext {
  /** Elements of the slide, in z order; `connector` and `hotspot` look up their siblings here. */
  elements(): readonly SlideElement[];
  /** Media asset by id, for list props such as the gallery items; null while unknown. */
  media(id: string): MediaRef | null;
  /** Present only in the student preview. */
  navigator: SlideNavigator | null;
  /** Present only in the student preview. */
  questions?: QuestionTracker | null;
}

export const SLIDE_CONTEXT: InjectionKey<SlideContext> = Symbol('slide-context');

const EMPTY_CONTEXT: SlideContext = { elements: () => [], media: () => null, navigator: null };

/** Makes the slide context available to the components drawn inside. */
export function provideSlideContext(context: SlideContext): void {
  provide(SLIDE_CONTEXT, context);
}

/** Slide context of the surrounding surface; an empty one outside a slide. */
export function useSlideContext(): SlideContext {
  return inject(SLIDE_CONTEXT, EMPTY_CONTEXT);
}
