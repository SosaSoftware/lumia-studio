import { reactive, watch } from 'vue';

/** Space kept free next to each side of the slide, in `cqw` (the slide is 100 wide). */
export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type MarginSide = keyof Margins;

/** Margin of every side until the person moves it. */
export const DEFAULT_MARGIN = 3;

/** Largest margin of one side. */
export const MAX_MARGIN = 20;

export const MARGINS_KEY = 'lumia.studio.canvas-margins';

/** Keeps a margin between zero and the largest one, with two decimals. */
export function clampMargin(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MARGIN;
  return Math.round(Math.min(Math.max(value, 0), MAX_MARGIN) * 100) / 100;
}

function defaults(): Margins {
  return { top: DEFAULT_MARGIN, right: DEFAULT_MARGIN, bottom: DEFAULT_MARGIN, left: DEFAULT_MARGIN };
}

function sideOf(value: unknown): number {
  return typeof value === 'number' ? clampMargin(value) : DEFAULT_MARGIN;
}

export function readMargins(storage: Storage = localStorage): Margins {
  try {
    const raw = storage.getItem(MARGINS_KEY);
    if (raw === null) return defaults();
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return defaults();
    const value: Record<string, unknown> = { ...parsed };
    return { top: sideOf(value.top), right: sideOf(value.right), bottom: sideOf(value.bottom), left: sideOf(value.left) };
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
