import { reactive, watch } from 'vue';

/** Space kept free next to each side of the slide, in `cqw` (the slide is 100 wide). */
export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type MarginSide = keyof Margins;

/** Margin of the top, right and left sides until the person moves them. */
export const DEFAULT_MARGIN = 3;

/** The bottom margin sits higher so its line stays above the footer of the slide, which reaches about 4.1 `cqw` from the bottom edge. */
export const DEFAULT_BOTTOM_MARGIN = 5;

/** Bottom margin before the footer was taken into account; a stored value equal to it is read as the current default. */
const PREVIOUS_BOTTOM_MARGIN = 3;

/** Largest margin of one side. */
export const MAX_MARGIN = 20;

export const MARGINS_KEY = 'lumia.studio.canvas-margins';

/** Keeps a margin between zero and the largest one, with two decimals. */
export function clampMargin(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MARGIN;
  return Math.round(Math.min(Math.max(value, 0), MAX_MARGIN) * 100) / 100;
}

/** Margin of a side until the person moves it. */
export function defaultMargin(side: MarginSide): number {
  return side === 'bottom' ? DEFAULT_BOTTOM_MARGIN : DEFAULT_MARGIN;
}

function defaults(): Margins {
  return { top: defaultMargin('top'), right: defaultMargin('right'), bottom: defaultMargin('bottom'), left: defaultMargin('left') };
}

function sideOf(value: unknown, side: MarginSide): number {
  if (typeof value !== 'number') return defaultMargin(side);
  if (side === 'bottom' && value === PREVIOUS_BOTTOM_MARGIN) return DEFAULT_BOTTOM_MARGIN;
  return clampMargin(value);
}

export function readMargins(storage: Storage = localStorage): Margins {
  try {
    const raw = storage.getItem(MARGINS_KEY);
    if (raw === null) return defaults();
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return defaults();
    const value: Record<string, unknown> = { ...parsed };
    return { top: sideOf(value.top, 'top'), right: sideOf(value.right, 'right'), bottom: sideOf(value.bottom, 'bottom'), left: sideOf(value.left, 'left') };
  } catch {
    // A corrupted stored value falls back to the default margins.
    return defaults();
  }
}

/** Margins of the editor canvas, remembered in `localStorage`: an editing aid of the person, not part of the class. */
export const canvasMargins = reactive<Margins>(readMargins());

watch(
  canvasMargins,
  (state) => {
    try {
      localStorage.setItem(MARGINS_KEY, JSON.stringify(state));
    } catch {
      // Not persisting the margins is harmless.
    }
  },
  { deep: true },
);
