import { SLIDE_HEIGHT, SLIDE_WIDTH } from '@lumia/packages/catalog';
import type { Geometry } from '@lumia/packages/catalog';
import type { Margins } from '../../composables/canvas-margins.ts';

export type { Geometry };

/** The eight resize handles, by the side or corner they sit on. */
export const RESIZE_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
export type ResizeHandle = (typeof RESIZE_HANDLES)[number];

/** Smallest width and height of an element, in `cqw`. */
export const MIN_SIZE = 2;

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** Converts a pointer distance in pixels to `cqw` units of the slide. */
export function pxToCqw(px: number, slideWidthPx: number): number {
  return slideWidthPx <= 0 ? 0 : (px / slideWidthPx) * SLIDE_WIDTH;
}

/** Keeps the element inside the slide, shrinking it first when it is larger than the slide. */
export function clampGeometry(g: Geometry): Geometry {
  const w = clamp(g.w, MIN_SIZE, SLIDE_WIDTH);
  const h = clamp(g.h, MIN_SIZE, SLIDE_HEIGHT);
  return {
    x: round2(clamp(g.x, 0, SLIDE_WIDTH - w)),
    y: round2(clamp(g.y, 0, SLIDE_HEIGHT - h)),
    w: round2(w),
    h: round2(h),
  };
}

/** Moves an element inside the margins of the slide; an axis where it does not fit between them is left as it is. */
export function fitInsideMargins(g: Geometry, margins: Margins): Geometry {
  const fitsWide = g.w <= SLIDE_WIDTH - margins.left - margins.right;
  const fitsTall = g.h <= SLIDE_HEIGHT - margins.top - margins.bottom;
  return {
    ...g,
    x: fitsWide ? round2(clamp(g.x, margins.left, SLIDE_WIDTH - margins.right - g.w)) : g.x,
    y: fitsTall ? round2(clamp(g.y, margins.top, SLIDE_HEIGHT - margins.bottom - g.h)) : g.y,
  };
}

export function moveGeometry(start: Geometry, dx: number, dy: number): Geometry {
  return clampGeometry({ ...start, x: start.x + dx, y: start.y + dy });
}

/** Resizes from a handle; the opposite side stays fixed and the element never leaves the slide. */
export function resizeGeometry(start: Geometry, handle: ResizeHandle, dx: number, dy: number): Geometry {
  let { x, y, w, h } = start;
  const right = start.x + start.w;
  const bottom = start.y + start.h;
  if (handle.includes('e')) {
    w = clamp(start.w + dx, MIN_SIZE, SLIDE_WIDTH - start.x);
  }
  if (handle.includes('w')) {
    x = clamp(start.x + dx, 0, right - MIN_SIZE);
    w = right - x;
  }
  if (handle.includes('s')) {
    h = clamp(start.h + dy, MIN_SIZE, SLIDE_HEIGHT - start.y);
  }
  if (handle.includes('n')) {
    y = clamp(start.y + dy, 0, bottom - MIN_SIZE);
    h = bottom - y;
  }
  return { x: round2(x), y: round2(y), w: round2(w), h: round2(h) };
}

export function sameGeometry(a: Geometry, b: Geometry): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

function intersects(a: Geometry, b: Geometry, gap: number): boolean {
  return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
}

/**
 * Top-left corner of the free area closest to the center of the slide where an element of `size` fits without
 * touching the others; null when there is none.
 */
export function findFreeSpot(occupied: readonly Geometry[], size: { w: number; h: number }, gap = 1, margin = 3): { x: number; y: number } | null {
  const w = Math.min(size.w, SLIDE_WIDTH - margin * 2);
  const h = Math.min(size.h, SLIDE_HEIGHT - margin * 2);
  const center = { x: SLIDE_WIDTH / 2, y: SLIDE_HEIGHT / 2 };
  let best: { x: number; y: number; distance: number } | null = null;
  for (let y = margin; y + h <= SLIDE_HEIGHT - margin; y += 1) {
    for (let x = margin; x + w <= SLIDE_WIDTH - margin; x += 1) {
      const candidate = { x, y, w, h };
      if (occupied.some((rect) => intersects(rect, candidate, gap))) continue;
      const distance = Math.hypot(x + w / 2 - center.x, (y + h / 2 - center.y) * 1.4);
      if (best === null || distance < best.distance) best = { x, y, distance };
    }
  }
  return best === null ? null : { x: best.x, y: best.y };
}
