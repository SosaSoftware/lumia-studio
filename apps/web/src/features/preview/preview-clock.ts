import type { NextUnlock, Pause, SlideElement } from '../../api/types.ts';

/** Seconds an exit animation lasts; `disappear` is instant. */
const EXIT_S: Readonly<Record<SlideElement['exit'], number>> = { none: 0, disappear: 0, fade: 0.5, slide: 0.5 };

/** Moment of an element at `elapsedS` seconds into its slide: not yet shown, shown, leaving or gone. */
export type ElementPhase = 'hidden' | 'shown' | 'leaving' | 'gone';

export function elementPhase(element: Pick<SlideElement, 'appearsAtS'> & Partial<Pick<SlideElement, 'exit' | 'disappearsAtS'>>, elapsedS: number): ElementPhase {
  if (elapsedS < element.appearsAtS) return 'hidden';
  const exit = element.exit ?? 'none';
  const leaves = element.disappearsAtS ?? null;
  if (exit === 'none' || leaves === null || elapsedS < leaves) return 'shown';
  return elapsedS < leaves + EXIT_S[exit] ? 'leaving' : 'gone';
}

/** Whether an element is on the slide at `elapsedS` seconds: it has appeared and has not finished leaving. */
export function isVisibleAt(element: Pick<SlideElement, 'appearsAtS'> & Partial<Pick<SlideElement, 'exit' | 'disappearsAtS'>>, elapsedS: number): boolean {
  const phase = elementPhase(element, elapsedS);
  return phase === 'shown' || phase === 'leaving';
}

/** How far the time of a slide has run. */
export interface TimelineState {
  done: boolean;
  /** From 0 to 1. */
  progress: number;
}

/** Progress of the duration of a slide, counted from its start. A slide without duration has nothing to wait for. */
export function timeState(durationS: number, elapsedS: number): TimelineState {
  if (durationS <= 0) return { done: true, progress: 1 };
  const progress = Math.min(Math.max(elapsedS / durationS, 0), 1);
  return { done: progress >= 1, progress };
}

/** The first pause that starts at or before `elapsedS` and has not been played yet. */
export function duePause(pauses: readonly Pause[], elapsedS: number, played: ReadonlySet<string>): Pause | null {
  return [...pauses].sort((a, b) => a.startsAtS - b.startsAtS).find((pause) => elapsedS >= pause.startsAtS && !played.has(pause.id)) ?? null;
}

/** Index after a step, kept inside the deck. */
export function stepIndex(index: number, delta: number, total: number): number {
  return Math.min(Math.max(index + delta, 0), Math.max(total - 1, 0));
}

/** What the slide still waits for before its Next button turns on: its time, its activities or its custom button. */
export type NextWait = 'time' | 'activities' | 'button' | null;

/** State of the Next button of a slide. */
export interface NextState {
  enabled: boolean;
  /** From 0 to 1: how much of what the slide waits for is done. 1 once enabled. */
  progress: number;
  waitsFor: NextWait;
}

/** What the rule of the Next button needs to know about the slide. */
export interface NextInputs {
  unlock: NextUnlock;
  /** Progress of the slide duration since the slide started. */
  time: TimelineState;
  activities: { total: number; completed: number };
  /** The slide has its custom button: a button with an action that moves on. */
  hasCustomButton: boolean;
  /** The Next button already turned on for this slide in this session. */
  unlockedBefore: boolean;
}

const ENABLED: NextState = { enabled: true, progress: 1, waitsFor: null };

/**
 * Rule of the lateral Next button. A slide never moves on by itself: the student presses Next once it is on. A slide
 * already unlocked in this session stays unlocked. With `custom_button` the lateral Next is never on, because a button of
 * the slide moves on instead; without that button the slide behaves as `always`, so the student is never stuck.
 */
export function nextState(inputs: NextInputs): NextState {
  if (inputs.unlock === 'custom_button') return inputs.hasCustomButton ? { enabled: false, progress: 0, waitsFor: 'button' } : ENABLED;
  if (inputs.unlockedBefore) return ENABLED;
  switch (inputs.unlock) {
    case 'always':
      return ENABLED;
    case 'after_time':
      return inputs.time.done ? ENABLED : { enabled: false, progress: inputs.time.progress, waitsFor: 'time' };
    case 'after_activities': {
      const { total, completed } = inputs.activities;
      return total === 0 || completed >= total ? ENABLED : { enabled: false, progress: completed / total, waitsFor: 'activities' };
    }
  }
}
