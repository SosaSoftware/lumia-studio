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
