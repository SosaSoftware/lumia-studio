import { DRAG_THRESHOLD_PX } from './drag-session.ts';

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A rectangle in pixels of the screen. */
export interface PixelRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * One press-and-drag on a free place of the canvas: it draws a rectangle that selects what it touches. A press that
 * does not travel past the drag threshold is a plain click on the canvas.
 */
export class MarqueeSession {
  private travelled = false;
  private current: Point;

  /**
   * @param origin Where the pointer went down.
   * @param additive Keeps the elements already selected (a modifier key was held).
   * @param base Ids selected when the press started.
   */
  public constructor(
    private readonly origin: Point,
    public readonly additive: boolean,
    public readonly base: readonly string[],
  ) {
    this.current = origin;
  }

  /** True once the pointer passed the drag threshold. */
  public get isDrag(): boolean {
    return this.travelled;
  }

  public update(point: Point): void {
    this.current = point;
    if (Math.hypot(point.x - this.origin.x, point.y - this.origin.y) >= DRAG_THRESHOLD_PX) this.travelled = true;
  }

  /** The rectangle between the press and the pointer, whichever way it was dragged. */
  public get rect(): PixelRect {
    return {
      left: Math.min(this.origin.x, this.current.x),
      top: Math.min(this.origin.y, this.current.y),
      width: Math.abs(this.current.x - this.origin.x),
      height: Math.abs(this.current.y - this.origin.y),
    };
  }
}
