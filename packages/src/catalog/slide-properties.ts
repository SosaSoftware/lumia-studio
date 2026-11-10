import type { ThemeColorKey } from './theme-tokens.ts';

/** Longest title a slide can have: it is shown in two lines under its thumbnail, and 40 characters is what fits there. */
export const SLIDE_TITLE_MAX_LENGTH = 40;

/**
 * How a slide moves on in the class: by itself when its time ends (`auto`), with a click (`click`), or once every
 * question on it is answered correctly or runs out of attempts (`on_complete`).
 */
export const ADVANCE_MODES = ['auto', 'click', 'on_complete'] as const;

export type AdvanceMode = (typeof ADVANCE_MODES)[number];

/** Background of a new slide, until the person or Lumi chooses another one. */
export const DEFAULT_SLIDE_BACKGROUND: ThemeColorKey = 'surface';

/** Duration in seconds of a new slide. */
export const DEFAULT_SLIDE_DURATION_S = 30;

/** How a new slide moves on. */
export const DEFAULT_SLIDE_ADVANCE: AdvanceMode = 'click';
