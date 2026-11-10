import { NO_GUIDES, SNAP_DISTANCE_PX, guidesFor, resizeGuidesFor, snapMove, snapResize } from './alignment.ts';
import type { Alignment, Guides } from './alignment.ts';
import type { Geometry, ResizeHandle } from './geometry.ts';
import { clampGeometry, moveGeometry, pxToCqw, resizeGeometry } from './geometry.ts';

export type DragOperation = { kind: 'move' } | { kind: 'resize'; handle: ResizeHandle };

/** Pixels the pointer must travel before a press counts as a drag and not as a click. */
export const DRAG_THRESHOLD_PX = 3;

/**
 * One pointer gesture on an element: turns pointer distances in pixels into a geometry in `cqw`. With an `alignment`,
 * a moved element is pulled onto the lines it can align with, and a resized one onto the size or the distance of
 * other elements; `guides` lists what matches.
 */
export class DragSession {
  private travelled = false;
  private aligned: Guides = NO_GUIDES;

  public constructor(
    public readonly operation: DragOperation,
    private readonly start: Geometry,
    private readonly slideWidthPx: number,
    private readonly alignment?: Alignment,
  ) {}

  /** True once the pointer passed the drag threshold. */
  public get isDrag(): boolean {
    return this.travelled;
  }

  /** What matches after the last update. */
  public get guides(): Guides {
    return this.aligned;
  }

  /** Geometry for a pointer that moved `dxPx` and `dyPx` since the press; `snap` false skips the alignment. */
  public update(dxPx: number, dyPx: number, snap = true): Geometry {
    if (Math.hypot(dxPx, dyPx) >= DRAG_THRESHOLD_PX) this.travelled = true;
    if (!this.travelled) return this.start;
    const dx = pxToCqw(dxPx, this.slideWidthPx);
    const dy = pxToCqw(dyPx, this.slideWidthPx);
    const threshold = pxToCqw(SNAP_DISTANCE_PX, this.slideWidthPx);
    if (this.operation.kind === 'resize') {
      const resized = resizeGeometry(this.start, this.operation.handle, dx, dy);
      if (this.alignment === undefined || !snap) {
        this.aligned = NO_GUIDES;
        return resized;
      }
      const geometry = clampGeometry(snapResize(resized, this.operation.handle, this.alignment.others, threshold));
      this.aligned = resizeGuidesFor(geometry, this.operation.handle, this.alignment.others);
      return geometry;
    }
    if (this.alignment === undefined || !snap) {
      this.aligned = NO_GUIDES;
      return moveGeometry(this.start, dx, dy);
    }
    const raw = { ...this.start, x: this.start.x + dx, y: this.start.y + dy };
    const geometry = clampGeometry(snapMove(raw, this.alignment, threshold));
    this.aligned = guidesFor(geometry, this.alignment);
    return geometry;
  }
}
