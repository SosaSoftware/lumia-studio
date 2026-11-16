/** "Pantalla: lo que ves" → label "Pantalla:" in bold and the rest, as the design writes list items. */
export function splitLabel(text: string): { label: string; rest: string } {
  const index = text.indexOf(': ');
  return index > 0 && index < 40 ? { label: text.slice(0, index + 1), rest: text.slice(index + 2) } : { label: '', rest: text };
}

/** `m:ss`. */
export function clock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(total / 60))}:${String(total % 60).padStart(2, '0')}`;
}

function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/**
 * Stable shuffle seeded by text, so a question shows the same order on every render.
 * With `avoidIdentity`, a list of two or more never keeps its original order.
 */
export function seededShuffle<T>(items: readonly T[], seed: string, avoidIdentity = false): T[] {
  const result = [...items];
  let state = hash(seed) || 1;
  const random = (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    const swap = result[index];
    const target = result[other];
    if (swap !== undefined && target !== undefined) {
      result[index] = target;
      result[other] = swap;
    }
  }
  if (avoidIdentity && result.length > 1 && result.every((item, index) => item === items[index])) {
    const first = result.shift();
    if (first !== undefined) result.push(first);
  }
  return result;
}

/** Letter of an option: A, B, C… */
export function letter(index: number): string {
  return String.fromCharCode(65 + index);
}

/** One run of a text: plain, or one of the highlighted phrases with its order of appearance. */
export interface HighlightSegment {
  text: string;
  marked: boolean;
  order: number;
}

/** Splits `text` at every occurrence of the phrases, ignoring case; longer phrases win over the ones they contain. */
export function splitHighlights(text: string, phrases: readonly string[]): HighlightSegment[] {
  const wanted = [...new Set(phrases.map((phrase) => phrase.trim()).filter((phrase) => phrase !== ''))].sort((a, b) => b.length - a.length);
  if (wanted.length === 0) return [{ text, marked: false, order: 0 }];
  const lower = text.toLocaleLowerCase();
  const segments: HighlightSegment[] = [];
  let cursor = 0;
  let order = 0;
  while (cursor < text.length) {
    let start = -1;
    let length = 0;
    for (const phrase of wanted) {
      const found = lower.indexOf(phrase.toLocaleLowerCase(), cursor);
      if (found >= 0 && (start < 0 || found < start)) {
        start = found;
        length = phrase.length;
      }
    }
    if (start < 0) break;
    if (start > cursor) segments.push({ text: text.slice(cursor, start), marked: false, order });
    segments.push({ text: text.slice(start, start + length), marked: true, order });
    order += 1;
    cursor = start + length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), marked: false, order });
  return segments;
}

/** Line numbers of a spec such as "2,4-6"; invalid parts are ignored. */
export function parseLineSpec(spec: string): Set<number> {
  const lines = new Set<number>();
  for (const part of spec.split(',')) {
    const match = /^\s*(\d+)(?:\s*-\s*(\d+))?\s*$/.exec(part);
    if (match === null) continue;
    const first = Number(match[1]);
    const last = match[2] === undefined ? first : Number(match[2]);
    for (let line = Math.min(first, last); line <= Math.max(first, last) && lines.size < 500; line += 1) lines.add(line);
  }
  return lines;
}

let sequence = 0;

/** Id unique in the document, for SVG references (gradients, markers) of components drawn several times at once. */
export function uniqueId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${String(sequence)}`;
}

/** Number in the Spanish format of the slides: thin-space thousands and a decimal comma. */
export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('es', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}

/** Smallest round number (1, 2, 2.5 or 5 times a power of ten) at or above `value`, for chart axes. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * power >= value) ?? 10;
  return step * power;
}
