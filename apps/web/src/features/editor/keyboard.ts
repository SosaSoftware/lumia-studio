import type { Geometry } from './geometry.ts';
import { clampGeometry } from './geometry.ts';

/** Distance of one arrow press, in `cqw`. */
export const KEY_STEP = 1;

export type KeyCommand =
  | { kind: 'move'; dx: number; dy: number }
  | { kind: 'resize'; dw: number; dh: number }
  | { kind: 'delete' };

function arrowVector(key: string): [number, number] | null {
  switch (key) {
    case 'ArrowLeft':
      return [-1, 0];
    case 'ArrowRight':
      return [1, 0];
    case 'ArrowUp':
      return [0, -1];
    case 'ArrowDown':
      return [0, 1];
    default:
      return null;
  }
}

/** Maps a key press on a selected element: arrows move, Shift + arrows resize, Delete removes. */
export function parseKey(key: string, shiftKey: boolean): KeyCommand | null {
  if (key === 'Delete' || key === 'Backspace') return { kind: 'delete' };
  const vector = arrowVector(key);
  if (vector === null) return null;
  const [x, y] = vector;
  return shiftKey ? { kind: 'resize', dw: x * KEY_STEP, dh: y * KEY_STEP } : { kind: 'move', dx: x * KEY_STEP, dy: y * KEY_STEP };
}

/** Geometry after a move or resize command; deletion leaves it unchanged. */
export function applyCommand(g: Geometry, command: KeyCommand): Geometry {
  switch (command.kind) {
    case 'move':
      return clampGeometry({ ...g, x: g.x + command.dx, y: g.y + command.dy });
    case 'resize':
      return clampGeometry({ ...g, w: g.w + command.dw, h: g.h + command.dh });
    case 'delete':
      return g;
  }
}

function fmt(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/** Spanish text for the `aria-live` region. */
export function announce(command: KeyCommand, g: Geometry, name: string): string {
  switch (command.kind) {
    case 'move':
      return `${name}: posición ${fmt(g.x)}, ${fmt(g.y)}.`;
    case 'resize':
      return `${name}: tamaño ${fmt(g.w)} por ${fmt(g.h)}.`;
    case 'delete':
      return `${name}: eliminado.`;
  }
}
