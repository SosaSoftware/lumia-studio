import { describe, expect, it } from 'vitest';
import { announce, applyCommand, parseKey } from './keyboard.ts';

const box = { x: 10, y: 10, w: 20, h: 10 };

describe('keyboard commands', () => {
  it('maps arrows to moves and Shift + arrows to resizes', () => {
    expect(parseKey('ArrowRight', false)).toEqual({ kind: 'move', dx: 1, dy: 0 });
    expect(parseKey('ArrowUp', false)).toEqual({ kind: 'move', dx: 0, dy: -1 });
    expect(parseKey('ArrowDown', true)).toEqual({ kind: 'resize', dw: 0, dh: 1 });
    expect(parseKey('ArrowLeft', true)).toEqual({ kind: 'resize', dw: -1, dh: 0 });
  });

  it('maps Delete and Backspace to deletion and ignores other keys', () => {
    expect(parseKey('Delete', false)).toEqual({ kind: 'delete' });
    expect(parseKey('Backspace', false)).toEqual({ kind: 'delete' });
    expect(parseKey('a', false)).toBeNull();
  });

  it('applies commands inside the slide bounds', () => {
    expect(applyCommand(box, { kind: 'move', dx: 1, dy: -1 })).toEqual({ x: 11, y: 9, w: 20, h: 10 });
    expect(applyCommand({ x: 0, y: 0, w: 20, h: 10 }, { kind: 'move', dx: -1, dy: -1 })).toEqual({ x: 0, y: 0, w: 20, h: 10 });
    expect(applyCommand(box, { kind: 'resize', dw: 1, dh: 1 })).toEqual({ x: 10, y: 10, w: 21, h: 11 });
    expect(applyCommand(box, { kind: 'delete' })).toEqual(box);
  });

  it('announces the result in Spanish', () => {
    expect(announce({ kind: 'move', dx: 1, dy: 0 }, box, 'Título')).toBe('Título: posición 10, 10.');
    expect(announce({ kind: 'resize', dw: 1, dh: 0 }, box, 'Título')).toBe('Título: tamaño 20 por 10.');
    expect(announce({ kind: 'delete' }, box, 'Título')).toBe('Título: eliminado.');
  });
});
