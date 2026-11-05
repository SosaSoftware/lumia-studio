import type { Pause, Slide, SlideElement } from '../../api/types.ts';
import { slideDuration } from '../timeline/timeline-model.ts';

/** Whether an element has appeared at `elapsedS` seconds into its slide. */
export function isVisibleAt(element: Pick<SlideElement, 'appearsAtS'>, elapsedS: number): boolean {
  return elapsedS >= element.appearsAtS;
}

/**
 * Whether an automatic slide has run its time. The slide lasts at least until its narration and its self-starting timers end.
 * Slides that advance with a click or when their questions are completed never finish by time.
 */
export function isFinished(slide: Pick<Slide, 'advance' | 'durationS'> & Partial<Pick<Slide, 'narrationClips' | 'elements'>>, elapsedS: number): boolean {
  if (slide.advance !== 'auto') return false;
  const duration = slideDuration({ durationS: slide.durationS, narrationClips: slide.narrationClips ?? [], elements: slide.elements ?? [] });
  return duration > 0 && elapsedS >= duration;
}

/** The first pause that starts at or before `elapsedS` and has not been played yet. */
export function duePause(pauses: readonly Pause[], elapsedS: number, played: ReadonlySet<string>): Pause | null {
  return [...pauses].sort((a, b) => a.startsAtS - b.startsAtS).find((pause) => elapsedS >= pause.startsAtS && !played.has(pause.id)) ?? null;
}

/** Index after a step, kept inside the deck. */
export function stepIndex(index: number, delta: number, total: number): number {
  return Math.min(Math.max(index + delta, 0), Math.max(total - 1, 0));
}

/** What the person may do to move on from a slide. */
export interface AdvanceState {
  /** The slide waits for its questions: moving forward is not allowed yet. */
  blocked: boolean;
  /** Every question is completed on an "Al completar" slide: the preview moves on by itself. */
  autoAdvance: boolean;
}

/**
 * Rule of the "Al completar" advance: the slide cannot be left forward until every question on it is completed, and then
 * it moves on by itself. A slide with that mode but without questions behaves like "Con clic".
 */
export function advanceState(advance: Slide['advance'], questionIds: readonly string[], completed: ReadonlySet<string>): AdvanceState {
  if (advance !== 'on_complete' || questionIds.length === 0) return { blocked: false, autoAdvance: false };
  const done = questionIds.every((id) => completed.has(id));
  return { blocked: !done, autoAdvance: done };
}
