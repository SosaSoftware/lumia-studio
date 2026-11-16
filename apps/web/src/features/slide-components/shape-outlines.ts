/**
 * Outlines of the basic shapes, drawn in a 100 × 100 box and stretched to the frame. Polygons list their points;
 * `path` shapes use SVG path data (curves). Both feed the fill clip and the stroke of `ShapeBlock` and the shape
 * picker of the Properties panel, so what the picker shows is what the slide draws.
 */
export interface ShapeOutline {
  /** SVG path data in the 100 × 100 box. */
  readonly path: string;
  /** Share of the frame, in percent, where text fits without leaving the shape: left, top, width and height. */
  readonly text: readonly [number, number, number, number];
}

function polygon(points: readonly (readonly [number, number])[]): string {
  return `M${points.map(([x, y]) => `${String(x)} ${String(y)}`).join(' L')}Z`;
}

function regular(sides: number, rotation = -90): string {
  return polygon(
    Array.from({ length: sides }, (_, index) => {
      const angle = ((rotation + (index * 360) / sides) * Math.PI) / 180;
      return [Math.round((50 + 48 * Math.cos(angle)) * 100) / 100, Math.round((50 + 48 * Math.sin(angle)) * 100) / 100] as const;
    }),
  );
}

function star(points: number): string {
  return polygon(
    Array.from({ length: points * 2 }, (_, index) => {
      const angle = ((-90 + (index * 180) / points) * Math.PI) / 180;
      const radius = index % 2 === 0 ? 48 : 20;
      return [Math.round((50 + radius * Math.cos(angle)) * 100) / 100, Math.round((50 + radius * Math.sin(angle)) * 100) / 100] as const;
    }),
  );
}

export const SHAPE_OUTLINES: Readonly<Record<string, ShapeOutline>> = {
  triangle: { path: polygon([[50, 3], [97, 97], [3, 97]]), text: [27, 45, 46, 45] },
  right_triangle: { path: polygon([[3, 3], [97, 97], [3, 97]]), text: [8, 48, 50, 45] },
  diamond: { path: polygon([[50, 2], [98, 50], [50, 98], [2, 50]]), text: [26, 26, 48, 48] },
  parallelogram: { path: polygon([[22, 8], [97, 8], [78, 92], [3, 92]]), text: [22, 8, 56, 84] },
  trapezoid: { path: polygon([[24, 10], [76, 10], [97, 90], [3, 90]]), text: [14, 10, 72, 80] },
  pentagon: { path: regular(5), text: [22, 30, 56, 55] },
  hexagon: { path: regular(6, 0), text: [14, 18, 72, 64] },
  octagon: { path: regular(8, -67.5), text: [12, 12, 76, 76] },
  star: { path: star(5), text: [30, 38, 40, 34] },
  cross: { path: polygon([[35, 3], [65, 3], [65, 35], [97, 35], [97, 65], [65, 65], [65, 97], [35, 97], [35, 65], [3, 65], [3, 35], [35, 35]]), text: [3, 35, 94, 30] },
  heart: { path: 'M50 94 C8 62 0 34 16 17 C30 3 46 10 50 27 C54 10 70 3 84 17 C100 34 92 62 50 94 Z', text: [18, 20, 64, 48] },
};

/** Shapes drawn with the CSS box (rounded corners) instead of an outline. */
export const BOX_SHAPES: ReadonlySet<string> = new Set(['rectangle', 'rounded', 'square', 'ellipse', 'circle']);

/** Shapes whose sides stay equal whatever the size of the frame. */
export const EQUAL_SIDES: ReadonlySet<string> = new Set(['square', 'circle']);

/** Order and names of the shapes in the picker; names are the Spanish labels of the Properties panel. */
export const SHAPE_ORDER: readonly string[] = [
  'rectangle',
  'rounded',
  'square',
  'ellipse',
  'circle',
  'triangle',
  'right_triangle',
  'diamond',
  'parallelogram',
  'trapezoid',
  'pentagon',
  'hexagon',
  'octagon',
  'star',
  'heart',
  'cross',
];

/** Path of a shape for the picker icon: boxes are drawn as rectangles or ellipses. */
export function pickerPath(kind: string): string {
  switch (kind) {
    case 'rectangle':
      return 'M4 20 H96 V80 H4Z';
    case 'rounded':
      return 'M18 20 H82 A14 14 0 0 1 96 34 V66 A14 14 0 0 1 82 80 H18 A14 14 0 0 1 4 66 V34 A14 14 0 0 1 18 20Z';
    case 'square':
      return 'M14 14 H86 V86 H14Z';
    case 'ellipse':
      return 'M50 20 A46 30 0 1 1 49.99 20Z';
    case 'circle':
      return 'M50 6 A44 44 0 1 1 49.99 6Z';
    default:
      return SHAPE_OUTLINES[kind]?.path ?? 'M4 20 H96 V80 H4Z';
  }
}
