/** Distance in pixels that the pointer travels before a press on a slide becomes a drag. */
export const REORDER_THRESHOLD_PX = 4;
/** Width of the band at each end of the strip where the pointer scrolls it. */
const EDGE_BAND_PX = 56;
/** Fastest scroll of the strip while dragging, in pixels per frame. */
const MAX_SCROLL_PX = 18;

/**
 * One drag of a slide along the strip, in the pixels of the scrolled content of the strip. It turns the pointer position
 * into how far the dragged slide travels, the index it would take if dropped there and how far each other slide moves
 * aside to leave the gap.
 */
export class SlideReorderSession {
  private readonly first: number;
  private readonly last: number;
  private readonly origin: number;
  private readonly count: number;
  private readonly pitch: number;

  /**
   * @param lefts Left edge of each slide in its place, from the first to the last; they are evenly spaced.
   * @param from Index of the dragged slide.
   * @param grabX Position of the pointer in the content of the strip when the drag started.
   */
  public constructor(
    lefts: readonly number[],
    public readonly from: number,
    private readonly grabX: number,
  ) {
    this.count = lefts.length;
    this.first = lefts[0] ?? 0;
    this.last = lefts[lefts.length - 1] ?? 0;
    this.origin = lefts[from] ?? 0;
    this.pitch = lefts.length > 1 ? (this.last - this.first) / (lefts.length - 1) : 0;
  }

  /** How far the dragged slide travels for a pointer at `pointerX`; it stays between the first and the last place. */
  public offset(pointerX: number): number {
    return Math.min(Math.max(pointerX - this.grabX, this.first - this.origin), this.last - this.origin);
  }

  /** Index the dragged slide takes when it is dropped after travelling `offset`. */
  public targetFor(offset: number): number {
    if (this.pitch === 0) return this.from;
    return Math.min(Math.max(Math.round((this.origin + offset - this.first) / this.pitch), 0), this.count - 1);
  }

  /** How far the slide at `index` moves aside so the dragged one has room at `target`. */
  public shiftOf(index: number, target: number): number {
    if (index === this.from) return 0;
    if (this.from < target && index > this.from && index <= target) return -this.pitch;
    if (this.from > target && index >= target && index < this.from) return this.pitch;
    return 0;
  }

  /** Left edge of the place at `index`. */
  public placeLeft(index: number): number {
    return this.first + index * this.pitch;
  }

  /** Pixels per frame to scroll the strip, negative to the left; zero when the pointer is away from both ends. */
  public static scrollSpeed(pointerX: number, left: number, right: number): number {
    if (pointerX < left + EDGE_BAND_PX) return -Math.min(MAX_SCROLL_PX, ((left + EDGE_BAND_PX - pointerX) / EDGE_BAND_PX) * MAX_SCROLL_PX);
    if (pointerX > right - EDGE_BAND_PX) return Math.min(MAX_SCROLL_PX, ((pointerX - (right - EDGE_BAND_PX)) / EDGE_BAND_PX) * MAX_SCROLL_PX);
    return 0;
  }
}
