import { SLIDE_HEIGHT, SLIDE_WIDTH } from '@lumia/packages/catalog';
import type { Margins } from '../../composables/canvas-margins.ts';
import { round2 } from './geometry.ts';
import type { Geometry, ResizeHandle } from './geometry.ts';

/**
 * A measuring line with a cap at each end: horizontal for the axis `x` (from `from` to `to`, at the height `at`) and
 * vertical for the axis `y` (from `from` to `to`, at the position `at`). All values are in `cqw`.
 */
export interface Segment {
  readonly axis: 'x' | 'y';
  readonly from: number;
  readonly to: number;
  readonly at: number;
}

/** What the canvas draws while an element moves or is resized. */
export interface Guides {
  /** Vertical lines where the element is aligned, by their `x`. */
  readonly vertical: readonly number[];
  /** Horizontal lines where the element is aligned, by their `y`. */
  readonly horizontal: readonly number[];
  /** Measuring lines that show an equal size or an equal distance. */
  readonly segments: readonly Segment[];
}

export const NO_GUIDES: Guides = { vertical: [], horizontal: [], segments: [] };

/** What an element can align with: the other elements of the slide and its margins. */
export interface Alignment {
  readonly others: readonly Geometry[];
  readonly margins: Margins;
}

/** Distance in pixels within which an edge, a center, a size or a distance is pulled onto a reference. */
export const SNAP_DISTANCE_PX = 6;

/** Difference in `cqw` under which two positions, sizes or distances count as equal. */
const ALIGNED_EPSILON = 0.06;

/** Smallest empty space between two elements that counts as a distance to compare. */
const MIN_GAP = 0.2;

/** How far from the element the marks of an equal size are drawn, in `cqw`. */
const SIZE_MARK_OFFSET = 1;

type Axis = 'x' | 'y';

function startOf(g: Geometry, axis: Axis): number {
  return axis === 'x' ? g.x : g.y;
}

function sizeOf(g: Geometry, axis: Axis): number {
  return axis === 'x' ? g.w : g.h;
}

function otherAxis(axis: Axis): Axis {
  return axis === 'x' ? 'y' : 'x';
}

// ---- Alignment while an element moves ------------------------------------------------------------------------

/** The start edge, the center or the end edge of an element on one axis. */
type Part = 'start' | 'center' | 'end';
const ALL_PARTS: readonly Part[] = ['start', 'center', 'end'];

/** A line of one axis and the parts of an element that may align with it. */
interface Line {
  readonly position: number;
  readonly parts: readonly Part[];
}

function partPosition(start: number, size: number, part: Part): number {
  if (part === 'start') return start;
  return part === 'center' ? start + size / 2 : start + size;
}

/** Lines of one axis that an element can align with: the center of the slide, its margins and the other elements. */
function linesOf(axis: Axis, alignment: Alignment): Line[] {
  const horizontal = axis === 'x';
  const slide = horizontal ? SLIDE_WIDTH : SLIDE_HEIGHT;
  const { margins } = alignment;
  const lines: Line[] = [
    { position: slide / 2, parts: ['center'] },
    { position: horizontal ? margins.left : margins.top, parts: ['start'] },
    { position: slide - (horizontal ? margins.right : margins.bottom), parts: ['end'] },
  ];
  for (const other of alignment.others) {
    const start = startOf(other, axis);
    const size = sizeOf(other, axis);
    for (const part of ALL_PARTS) lines.push({ position: partPosition(start, size, part), parts: ALL_PARTS });
  }
  return lines;
}

/** Shift that puts a part of the element on the nearest line within `threshold`; zero when no line is near. */
function snapShift(start: number, size: number, lines: readonly Line[], threshold: number): number {
  let best: number | null = null;
  for (const line of lines) {
    for (const part of line.parts) {
      const delta = line.position - partPosition(start, size, part);
      if (Math.abs(delta) <= threshold && (best === null || Math.abs(delta) < Math.abs(best))) best = delta;
    }
  }
  return best ?? 0;
}

/** Moves an element onto the nearest alignment line of each axis, when one is within `threshold` (in `cqw`). */
export function snapMove(moved: Geometry, alignment: Alignment, threshold: number): Geometry {
  const dx = snapShift(moved.x, moved.w, linesOf('x', alignment), threshold);
  const dy = snapShift(moved.y, moved.h, linesOf('y', alignment), threshold);
  return { ...moved, x: moved.x + dx, y: moved.y + dy };
}

function alignedLines(start: number, size: number, lines: readonly Line[]): number[] {
  const found = new Set<number>();
  for (const line of lines) {
    for (const part of line.parts) {
      if (Math.abs(line.position - partPosition(start, size, part)) <= ALIGNED_EPSILON) found.add(round2(line.position));
    }
  }
  return [...found];
}

/** Lines the element is aligned with right now. */
export function guidesFor(geometry: Geometry, alignment: Alignment): Guides {
  return {
    vertical: alignedLines(geometry.x, geometry.w, linesOf('x', alignment)),
    horizontal: alignedLines(geometry.y, geometry.h, linesOf('y', alignment)),
    segments: [],
  };
}

// ---- Equal size and equal distance while an element is resized ----------------------------------------------

/** An empty space between two elements on an axis, and where to draw its measuring line on the other axis. */
interface Gap {
  readonly from: number;
  readonly to: number;
  readonly at: number;
}

/** The range that two elements share on an axis; null when they do not overlap there. */
function sharedRange(a: Geometry, b: Geometry, axis: Axis): { from: number; to: number } | null {
  const from = Math.max(startOf(a, axis), startOf(b, axis));
  const to = Math.min(startOf(a, axis) + sizeOf(a, axis), startOf(b, axis) + sizeOf(b, axis));
  return to > from ? { from, to } : null;
}

/** Empty spaces between pairs of other elements that face each other on an axis. */
function referenceGaps(others: readonly Geometry[], axis: Axis): Gap[] {
  const gaps: Gap[] = [];
  for (const a of others) {
    for (const b of others) {
      if (a === b) continue;
      const from = startOf(a, axis) + sizeOf(a, axis);
      const to = startOf(b, axis);
      if (to - from <= MIN_GAP) continue;
      const shared = sharedRange(a, b, otherAxis(axis));
      if (shared !== null) gaps.push({ from, to, at: (shared.from + shared.to) / 2 });
    }
  }
  return gaps;
}

/** The empty space between the moving edge of an element and the nearest element that faces it; null when none does. */
function neighborGap(g: Geometry, axis: Axis, movingEnd: boolean, others: readonly Geometry[]): Gap | null {
  const edge = movingEnd ? startOf(g, axis) + sizeOf(g, axis) : startOf(g, axis);
  let best: Gap | null = null;
  for (const other of others) {
    const shared = sharedRange(g, other, otherAxis(axis));
    if (shared === null) continue;
    const gap: Gap = movingEnd
      ? { from: edge, to: startOf(other, axis), at: (shared.from + shared.to) / 2 }
      : { from: startOf(other, axis) + sizeOf(other, axis), to: edge, at: (shared.from + shared.to) / 2 };
    if (gap.to - gap.from < 0) continue;
    if (best === null || gap.to - gap.from < best.to - best.from) best = gap;
  }
  return best;
}

/** Positions the moving edge could take to match the size of another element or the distance between two others. */
function edgeCandidates(g: Geometry, axis: Axis, movingEnd: boolean, others: readonly Geometry[]): number[] {
  const start = startOf(g, axis);
  const end = start + sizeOf(g, axis);
  const candidates = others.map((other) => (movingEnd ? start + sizeOf(other, axis) : end - sizeOf(other, axis)));
  const neighbor = neighborGap(g, axis, movingEnd, others);
  if (neighbor === null) return candidates;
  for (const reference of referenceGaps(others, axis)) {
    const size = reference.to - reference.from;
    candidates.push(movingEnd ? neighbor.to - size : neighbor.from + size);
  }
  return candidates;
}

/** Shift of the moving edge to the nearest candidate within `threshold`; zero when none is near. */
function edgeShift(g: Geometry, axis: Axis, movingEnd: boolean, others: readonly Geometry[], threshold: number): number {
  const edge = movingEnd ? startOf(g, axis) + sizeOf(g, axis) : startOf(g, axis);
  let best: number | null = null;
  for (const candidate of edgeCandidates(g, axis, movingEnd, others)) {
    const delta = candidate - edge;
    if (Math.abs(delta) <= threshold && (best === null || Math.abs(delta) < Math.abs(best))) best = delta;
  }
  return best ?? 0;
}

/**
 * Resizes an element onto the size of another element, or onto the distance that two others have between them, when
 * the moving edge is within `threshold` (in `cqw`) of it.
 */
export function snapResize(resized: Geometry, handle: ResizeHandle, others: readonly Geometry[], threshold: number): Geometry {
  let { x, y, w, h } = resized;
  if (handle.includes('e')) w += edgeShift(resized, 'x', true, others, threshold);
  if (handle.includes('w')) {
    const shift = edgeShift(resized, 'x', false, others, threshold);
    x += shift;
    w -= shift;
  }
  if (handle.includes('s')) h += edgeShift(resized, 'y', true, others, threshold);
  if (handle.includes('n')) {
    const shift = edgeShift(resized, 'y', false, others, threshold);
    y += shift;
    h -= shift;
  }
  return { x, y, w, h };
}

function sizeMark(item: Geometry, axis: Axis): Segment {
  return axis === 'x'
    ? { axis, from: item.x, to: item.x + item.w, at: item.y + item.h + SIZE_MARK_OFFSET }
    : { axis, from: item.y, to: item.y + item.h, at: item.x + item.w + SIZE_MARK_OFFSET };
}

/** Marks on the resized element and on every element that has the same size on the axis. */
function sizeSegments(g: Geometry, axis: Axis, others: readonly Geometry[]): Segment[] {
  const same = others.filter((other) => Math.abs(sizeOf(other, axis) - sizeOf(g, axis)) <= ALIGNED_EPSILON);
  return same.length === 0 ? [] : [g, ...same].map((item) => sizeMark(item, axis));
}

/** Measuring lines for the distance to the neighbor and for every pair of others that have the same distance. */
function gapSegments(g: Geometry, axis: Axis, movingEnd: boolean, others: readonly Geometry[]): Segment[] {
  const neighbor = neighborGap(g, axis, movingEnd, others);
  if (neighbor === null) return [];
  const size = neighbor.to - neighbor.from;
  const same = referenceGaps(others, axis).filter((reference) => Math.abs(reference.to - reference.from - size) <= ALIGNED_EPSILON);
  return same.length === 0 ? [] : [neighbor, ...same].map((gap) => ({ axis, from: gap.from, to: gap.to, at: gap.at }));
}

/** Measuring lines for the sizes and distances that match after resizing from `handle`. */
export function resizeGuidesFor(geometry: Geometry, handle: ResizeHandle, others: readonly Geometry[]): Guides {
  const segments: Segment[] = [];
  const axes: readonly { axis: Axis; movesEnd: boolean; movesStart: boolean }[] = [
    { axis: 'x', movesEnd: handle.includes('e'), movesStart: handle.includes('w') },
    { axis: 'y', movesEnd: handle.includes('s'), movesStart: handle.includes('n') },
  ];
  for (const { axis, movesEnd, movesStart } of axes) {
    if (!movesEnd && !movesStart) continue;
    segments.push(...sizeSegments(geometry, axis, others));
    if (movesEnd) segments.push(...gapSegments(geometry, axis, true, others));
    if (movesStart) segments.push(...gapSegments(geometry, axis, false, others));
  }
  return { vertical: [], horizontal: [], segments };
}
