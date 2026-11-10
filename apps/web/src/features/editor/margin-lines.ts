import { SLIDE_HEIGHT, SLIDE_WIDTH } from '@lumia/packages/catalog';
import { canvasMargins, clampMargin } from '../../composables/canvas-margins.ts';
import type { MarginSide } from '../../composables/canvas-margins.ts';
import { pxToCqw } from './geometry.ts';

/** Whether a margin sits on the left or right side of the slide; the top and bottom margins sit on the other axis. */
export function isSideMargin(side: MarginSide): boolean {
  return side === 'left' || side === 'right';
}

/** Position of the line of a margin: `x` for the side margins and `y` for the top and bottom ones, in `cqw`. */
export function marginLine(side: MarginSide): number {
  switch (side) {
    case 'left':
      return canvasMargins.left;
    case 'right':
      return SLIDE_WIDTH - canvasMargins.right;
    case 'top':
      return canvasMargins.top;
    case 'bottom':
      return SLIDE_HEIGHT - canvasMargins.bottom;
  }
}

/** One pointer gesture on a margin, from its line or from its marker on a ruler. */
export class MarginDrag {
  private readonly origin: number;
  private readonly start: number;

  public constructor(
    private readonly side: MarginSide,
    event: PointerEvent,
    private readonly slideWidthPx: number,
  ) {
    this.origin = isSideMargin(side) ? event.clientX : event.clientY;
    this.start = canvasMargins[side];
  }

  /** Sets the margin for the pointer position. */
  public update(event: PointerEvent): void {
    const pointer = isSideMargin(this.side) ? event.clientX : event.clientY;
    const distance = pxToCqw(pointer - this.origin, this.slideWidthPx);
    // The left and top lines grow their margin when they move away from the edge; the right and bottom ones, toward it.
    const direction = this.side === 'left' || this.side === 'top' ? 1 : -1;
    canvasMargins[this.side] = clampMargin(this.start + direction * distance);
  }
}
