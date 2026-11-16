/** Rectangle of an element on the slide, in slide units (the slide is 100 wide). */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export type Side = 'top' | 'right' | 'bottom' | 'left';
export type Anchor = Side | 'auto';
export type RouteStyle = 'straight' | 'curved' | 'elbow';

/** Direction pointing out of a box through each side. */
const OUTWARD: Readonly<Record<Side, Point>> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

export function center(box: Box): Point {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

export function isSide(value: unknown): value is Side {
  return value === 'top' || value === 'right' || value === 'bottom' || value === 'left';
}

/** Side of `box` that faces `toward`: the one along the dominant axis of the line between both centers. */
export function facingSide(box: Box, toward: Box): Side {
  const from = center(box);
  const to = center(toward);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) * box.h >= Math.abs(dy) * box.w) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}

/** Middle of a side of `box`, pushed `gap` units out of it. */
export function anchorPoint(box: Box, side: Side, gap: number): Point {
  const { x, y } = center(box);
  const out = OUTWARD[side];
  switch (side) {
    case 'top':
      return { x, y: box.y + out.y * gap };
    case 'bottom':
      return { x, y: box.y + box.h + out.y * gap };
    case 'left':
      return { x: box.x + out.x * gap, y };
    default:
      return { x: box.x + box.w + out.x * gap, y };
  }
}

/** Moves `point` `distance` units out of the side it belongs to. */
export function pushOut(point: Point, side: Side, distance: number): Point {
  const out = OUTWARD[side];
  return { x: point.x + out.x * distance, y: point.y + out.y * distance };
}

const horizontal = (side: Side): boolean => side === 'left' || side === 'right';

function fixed(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/** SVG path from `a` (leaving through `sideA`) to `b` (arriving through `sideB`). */
export function routePath(style: RouteStyle, a: Point, sideA: Side, b: Point, sideB: Side): string {
  const start = `M${fixed(a.x)} ${fixed(a.y)}`;
  if (style === 'curved') {
    const reach = Math.max(2, Math.hypot(b.x - a.x, b.y - a.y) * 0.4);
    const c1 = pushOut(a, sideA, reach);
    const c2 = pushOut(b, sideB, reach);
    return `${start} C${fixed(c1.x)} ${fixed(c1.y)} ${fixed(c2.x)} ${fixed(c2.y)} ${fixed(b.x)} ${fixed(b.y)}`;
  }
  if (style === 'elbow') {
    if (horizontal(sideA) && horizontal(sideB)) {
      const middle = (a.x + b.x) / 2;
      return `${start} H${fixed(middle)} V${fixed(b.y)} H${fixed(b.x)}`;
    }
    if (!horizontal(sideA) && !horizontal(sideB)) {
      const middle = (a.y + b.y) / 2;
      return `${start} V${fixed(middle)} H${fixed(b.x)} V${fixed(b.y)}`;
    }
    return horizontal(sideA) ? `${start} H${fixed(b.x)} V${fixed(b.y)}` : `${start} V${fixed(b.y)} H${fixed(b.x)}`;
  }
  return `${start} L${fixed(b.x)} ${fixed(b.y)}`;
}

export interface LinkedRoute {
  readonly path: string;
  readonly from: Point;
  readonly to: Point;
}

/**
 * Route between two elements. `tail` and `head` are how far, in slide units, the line stops short of each border so
 * the arrow heads drawn by markers end exactly on the border.
 */
export function linkElements(from: Box, to: Box, fromAnchor: Anchor, toAnchor: Anchor, style: RouteStyle, gap: number, tail: number, head: number): LinkedRoute {
  const sideA = isSide(fromAnchor) ? fromAnchor : facingSide(from, to);
  const sideB = isSide(toAnchor) ? toAnchor : facingSide(to, from);
  const a = anchorPoint(from, sideA, gap);
  const b = anchorPoint(to, sideB, gap);
  return { path: routePath(style, pushOut(a, sideA, tail), sideA, pushOut(b, sideB, head), sideB), from: a, to: b };
}
