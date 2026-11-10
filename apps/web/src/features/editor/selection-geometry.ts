import type { Alignment } from './alignment.ts';
import { round2 } from './geometry.ts';
import type { Geometry } from './geometry.ts';

/** What a frame needs to move together with the other elements of a selection. */
export interface GroupContext {
  /** Rectangle that holds every selected element, in `cqw`. */
  bounds: () => Geometry;
  /** What the group can align with: the elements that are not selected, and the margins. */
  alignment: () => Alignment;
}

/** Where an element sits, in `cqw`, with the id the change refers to. */
export interface Placed extends Geometry {
  readonly id: string;
}

/** New geometry of one element of a selection. */
export interface PlacedChange {
  readonly id: string;
  readonly geometry: Geometry;
}

export type AlignKind = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type DistributeAxis = 'horizontal' | 'vertical';

/** Smallest rectangle that holds all the geometries; null when there are none. */
export function boundsOf(items: readonly Geometry[]): Geometry | null {
  if (items.length === 0) return null;
  const left = Math.min(...items.map((item) => item.x));
  const top = Math.min(...items.map((item) => item.y));
  const right = Math.max(...items.map((item) => item.x + item.w));
  const bottom = Math.max(...items.map((item) => item.y + item.h));
  return { x: round2(left), y: round2(top), w: round2(right - left), h: round2(bottom - top) };
}

/** True when the rectangles overlap or touch, which is what a selection rectangle needs to pick an element. */
export function touches(a: Geometry, b: Geometry): boolean {
  return a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
}

function placedAt(item: Placed, x: number, y: number): PlacedChange {
  return { id: item.id, geometry: { x: round2(x), y: round2(y), w: item.w, h: item.h } };
}

/** Moves every element by the same distance. */
export function translateItems(items: readonly Placed[], dx: number, dy: number): PlacedChange[] {
  return items.map((item) => placedAt(item, item.x + dx, item.y + dy));
}

/** Lines the elements up with an edge or the center of the rectangle that holds all of them. */
export function alignItems(items: readonly Placed[], kind: AlignKind): PlacedChange[] {
  const bounds = boundsOf(items);
  if (bounds === null) return [];
  return items.map((item) => {
    switch (kind) {
      case 'left':
        return placedAt(item, bounds.x, item.y);
      case 'center':
        return placedAt(item, bounds.x + (bounds.w - item.w) / 2, item.y);
      case 'right':
        return placedAt(item, bounds.x + bounds.w - item.w, item.y);
      case 'top':
        return placedAt(item, item.x, bounds.y);
      case 'middle':
        return placedAt(item, item.x, bounds.y + (bounds.h - item.h) / 2);
      case 'bottom':
        return placedAt(item, item.x, bounds.y + bounds.h - item.h);
    }
  });
}

/** Leaves the same space between consecutive elements; the first and the last stay where they are. Needs three or more. */
export function distributeItems(items: readonly Placed[], axis: DistributeAxis): PlacedChange[] {
  if (items.length < 3) return [];
  const horizontal = axis === 'horizontal';
  const sorted = [...items].sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === undefined || last === undefined) return [];
  const start = horizontal ? first.x : first.y;
  const end = horizontal ? last.x + last.w : last.y + last.h;
  const used = sorted.reduce((sum, item) => sum + (horizontal ? item.w : item.h), 0);
  const gap = (end - start - used) / (sorted.length - 1);
  let cursor = start;
  return sorted.map((item) => {
    const change = horizontal ? placedAt(item, cursor, item.y) : placedAt(item, item.x, cursor);
    cursor += (horizontal ? item.w : item.h) + gap;
    return change;
  });
}
