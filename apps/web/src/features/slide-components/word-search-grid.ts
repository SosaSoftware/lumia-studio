/** One cell of the board, by row and column. */
export interface GridCell {
  row: number;
  column: number;
}

/** Where a word was hidden: its cells from the first letter to the last. */
export interface WordPlacement {
  word: string;
  cells: GridCell[];
}

export interface WordSearchOptions {
  size: number;
  diagonal: boolean;
  backwards: boolean;
}

const FILLER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Uppercase letters without accents, so É is found as E; Ñ stays as it is. */
export function normalizeWord(word: string): string {
  return word
    .toLocaleUpperCase('es')
    .normalize('NFD')
    .replace(/N\u0303/g, 'Ñ')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-ZÑ]/g, '');
}

/**
 * Board of a word search. Words are placed one by one, longest first, in random free positions and directions;
 * a word that does not fit after many tries is left out and reported in `skipped`. The random source is injected so
 * the same props always build the same board.
 */
export class WordSearchGrid {
  public readonly letters: string[][];
  public readonly placements: WordPlacement[] = [];
  public readonly skipped: string[] = [];

  public constructor(
    words: readonly string[],
    private readonly options: WordSearchOptions,
    private readonly random: () => number,
  ) {
    const size = options.size;
    this.letters = Array.from({ length: size }, () => Array.from({ length: size }, () => ''));
    const unique = [...new Set(words.map(normalizeWord).filter((word) => word.length >= 2 && word.length <= size))];
    for (const word of unique.sort((a, b) => b.length - a.length)) {
      if (!this.place(word)) this.skipped.push(word);
    }
    for (const row of this.letters) {
      for (let column = 0; column < row.length; column += 1) {
        if (row[column] === '') row[column] = FILLER.charAt(Math.floor(this.random() * FILLER.length));
      }
    }
  }

  /** Placement whose cells are exactly the selected line, in either direction; null when none matches. */
  public match(line: readonly GridCell[]): WordPlacement | null {
    const key = (cells: readonly GridCell[]): string => cells.map((cell) => `${String(cell.row)}:${String(cell.column)}`).join('|');
    const forward = key(line);
    const backward = key([...line].reverse());
    return this.placements.find((placement) => {
      const candidate = key(placement.cells);
      return candidate === forward || candidate === backward;
    }) ?? null;
  }

  private directions(): [number, number][] {
    const result: [number, number][] = [
      [0, 1],
      [1, 0],
    ];
    if (this.options.diagonal) result.push([1, 1], [-1, 1]);
    if (this.options.backwards) result.push(...result.map(([dr, dc]): [number, number] => [-dr, -dc]));
    return result;
  }

  private place(word: string): boolean {
    const size = this.options.size;
    const directions = this.directions();
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const direction = directions[Math.floor(this.random() * directions.length)];
      if (direction === undefined) return false;
      const [dr, dc] = direction;
      const row = Math.floor(this.random() * size);
      const column = Math.floor(this.random() * size);
      const cells: GridCell[] = Array.from({ length: word.length }, (_, index) => ({ row: row + dr * index, column: column + dc * index }));
      const fits = cells.every((cell, index) => {
        if (cell.row < 0 || cell.row >= size || cell.column < 0 || cell.column >= size) return false;
        const current = this.letters[cell.row]?.[cell.column] ?? '';
        return current === '' || current === word.charAt(index);
      });
      if (!fits) continue;
      cells.forEach((cell, index) => {
        const rowLetters = this.letters[cell.row];
        if (rowLetters !== undefined) rowLetters[cell.column] = word.charAt(index);
      });
      this.placements.push({ word, cells });
      return true;
    }
    return false;
  }
}

/** Cells of the straight line from `start` to `end`, or an empty list when they are not aligned. */
export function lineBetween(start: GridCell, end: GridCell): GridCell[] {
  const dr = end.row - start.row;
  const dc = end.column - start.column;
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return [];
  const steps = Math.max(Math.abs(dr), Math.abs(dc));
  const stepRow = Math.sign(dr);
  const stepColumn = Math.sign(dc);
  return Array.from({ length: steps + 1 }, (_, index) => ({ row: start.row + stepRow * index, column: start.column + stepColumn * index }));
}
