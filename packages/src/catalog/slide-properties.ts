import type { ThemeColorKey } from './theme-tokens.ts';

/** Longest title a slide can have: it is shown in two lines under its thumbnail, and 40 characters is what fits there. */
export const SLIDE_TITLE_MAX_LENGTH = 40;

/**
 * When the Next button of a slide turns on. A slide never moves on by itself: the student presses Next once it is on.
 * `always` from the start; `after_time` once the slide duration has run, counted from the start of the slide;
 * `after_activities` once every question and game is completed; `custom_button` never: a button of the slide that
 * moves on (`next_slide` or `go_to_slide`) replaces the lateral Next.
 */
export const NEXT_UNLOCKS = ['always', 'after_time', 'after_activities', 'custom_button'] as const;

export type NextUnlock = (typeof NEXT_UNLOCKS)[number];

/**
 * How a slide with the rule `after_time` starts: by itself when it opens (`auto`), or when the student presses its start
 * button, a button with the action `start_slide` (`button`). Until it starts, its clock, narration and components wait.
 */
export const START_MODES = ['auto', 'button'] as const;

export type StartMode = (typeof START_MODES)[number];

/** Catalog key of the button component, the only one a slide can use as start or custom button. */
export const BUTTON_COMPONENT = 'button_link';

/** Button action that starts its slide. */
export const START_BUTTON_ACTION = 'start_slide';

/** Button actions that move on, so the button can replace the lateral Next. */
export const ADVANCING_BUTTON_ACTIONS: readonly string[] = ['next_slide', 'go_to_slide'];

/** Background of a new slide, until the person or Lumi chooses another one. */
export const DEFAULT_SLIDE_BACKGROUND: ThemeColorKey = 'surface';

/** Duration in seconds of a new slide. */
export const DEFAULT_SLIDE_DURATION_S = 30;

/** When the Next button of a new slide turns on. */
export const DEFAULT_SLIDE_UNLOCK: NextUnlock = 'always';

/** How a new slide starts. */
export const DEFAULT_SLIDE_START_MODE: StartMode = 'auto';
