import type { Geometry, ResizeHandle } from './geometry.ts';
import { moveGeometry, pxToCqw, resizeGeometry } from './geometry.ts';

export type DragOperation = { kind: 'move' } | { kind: 'resize'; handle: ResizeHandle };

/** Pixels the pointer must travel before a press counts as a drag and not as a click. */
export const DRAG_THRESHOLD_PX = 3;

/** One pointer gesture on an element: turns pointer distances in pixels into a geometry in `cqw`. */
export class DragSession {
  private travelled = false;

  public constructor(
    public readonly operation: DragOperation,
    private readonly start: Geometry,
    private readonly slideWidthPx: number,
  ) {}

  /** True once the pointer passed the drag threshold. */
  public get isDrag(): boolean {
    return this.travelled;
  }

  /** Geometry for a pointer that moved `dxPx` and `dyPx` since the press. */
  public update(dxPx: number, dyPx: number): Geometry {
    if (Math.hypot(dxPx, dyPx) >= DRAG_THRESHOLD_PX) this.travelled = true;
    if (!this.travelled) return this.start;
    const dx = pxToCqw(dxPx, this.slideWidthPx);
    const dy = pxToCqw(dyPx, this.slideWidthPx);
    return this.operation.kind === 'move'
      ? moveGeometry(this.start, dx, dy)
      : resizeGeometry(this.start, this.operation.handle, dx, dy);
  }
}
