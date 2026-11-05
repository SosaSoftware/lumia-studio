import { describe, expect, it } from 'vitest';
import { DragSession } from './drag-session.ts';
import { clampGeometry, moveGeometry, pxToCqw, resizeGeometry } from './geometry.ts';

const box = { x: 10, y: 10, w: 20, h: 10 };

describe('geometry', () => {
  it('converts pixels to cqw of a 1000 px wide slide', () => {
    expect(pxToCqw(100, 1000)).toBe(10);
    expect(pxToCqw(5, 0)).toBe(0);
  });

  it('moves and keeps the element inside the slide', () => {
    expect(moveGeometry(box, 5, 3)).toEqual({ x: 15, y: 13, w: 20, h: 10 });
    expect(moveGeometry(box, -50, -50)).toEqual({ x: 0, y: 0, w: 20, h: 10 });
    expect(moveGeometry(box, 500, 500)).toEqual({ x: 80, y: 46.25, w: 20, h: 10 });
  });

  it('resizes from the east and south handles', () => {
    expect(resizeGeometry(box, 'se', 4, 2)).toEqual({ x: 10, y: 10, w: 24, h: 12 });
    expect(resizeGeometry(box, 'e', 500, 0)).toEqual({ x: 10, y: 10, w: 90, h: 10 });
  });

  it('keeps the opposite side fixed when resizing from the west and north handles', () => {
    expect(resizeGeometry(box, 'nw', 4, 3)).toEqual({ x: 14, y: 13, w: 16, h: 7 });
    expect(resizeGeometry(box, 'w', -50, 0)).toEqual({ x: 0, y: 10, w: 30, h: 10 });
  });

  it('never goes below the minimum size', () => {
    const shrunk = resizeGeometry(box, 'se', -100, -100);
    expect(shrunk.w).toBe(2);
    expect(shrunk.h).toBe(2);
    expect(resizeGeometry(box, 'nw', 100, 100)).toEqual({ x: 28, y: 18, w: 2, h: 2 });
  });

  it('clamps an element larger than the slide', () => {
    expect(clampGeometry({ x: 5, y: 5, w: 200, h: 100 })).toEqual({ x: 0, y: 0, w: 100, h: 56.25 });
  });
});

describe('DragSession', () => {
  it('treats a small movement as a click', () => {
    const session = new DragSession({ kind: 'move' }, box, 1000);
    expect(session.update(1, 1)).toEqual(box);
    expect(session.isDrag).toBe(false);
  });

  it('moves by the pointer distance relative to the slide width', () => {
    const session = new DragSession({ kind: 'move' }, box, 1000);
    expect(session.update(100, 50)).toEqual({ x: 20, y: 15, w: 20, h: 10 });
    expect(session.isDrag).toBe(true);
  });

  it('resizes from a handle', () => {
    const session = new DragSession({ kind: 'resize', handle: 'se' }, box, 500);
    expect(session.update(50, 25)).toEqual({ x: 10, y: 10, w: 30, h: 15 });
  });
});
