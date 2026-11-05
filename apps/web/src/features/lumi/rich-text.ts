/** A run of text, bold or not. */
export interface Inline {
  text: string;
  bold: boolean;
}

export type Block = { kind: 'p'; inlines: Inline[] } | { kind: 'ul' | 'ol'; items: Inline[][] };

/** Splits `**bold**` runs; anything else stays as text, so nothing is interpreted as HTML. */
export function parseInline(text: string): Inline[] {
  const parts: Inline[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index;
    if (index > last) parts.push({ text: text.slice(last, index), bold: false });
    parts.push({ text: match[1] ?? '', bold: true });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), bold: false });
  return parts.length === 0 ? [{ text, bold: false }] : parts;
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBER = /^\s*\d+[.)]\s+(.*)$/;

/** Paragraphs and lists of a reply written in plain text or light Markdown. */
export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = (): void => {
    if (paragraph.length > 0) blocks.push({ kind: 'p', inlines: parseInline(paragraph.join('\n')) });
    paragraph = [];
  };
  for (const line of text.split('\n')) {
    const bullet = BULLET.exec(line);
    const number = bullet === null ? NUMBER.exec(line) : null;
    const item = bullet?.[1] ?? number?.[1];
    if (item !== undefined) {
      flush();
      const kind = bullet !== null ? 'ul' : 'ol';
      const previous = blocks[blocks.length - 1];
      if (previous?.kind === kind) previous.items.push(parseInline(item));
      else blocks.push({ kind, items: [parseInline(item)] });
    } else if (line.trim() === '') {
      flush();
    } else {
      paragraph.push(line.replace(/^#{1,6}\s+/, ''));
    }
  }
  flush();
  return blocks;
}
