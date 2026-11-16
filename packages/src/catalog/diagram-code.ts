/**
 * Text format of the diagram components: a subset of Mermaid that people can write by hand and Lumi already knows.
 *
 * - `flowchart`: nodes `A[texto]` (rectangle), `A(texto)` (rounded), `A([texto])` (pill), `A((texto))` (circle) and
 *   `A{texto}` (diamond); links `-->`, `---`, `-.->` and `==>`, with a label as `-->|texto|` or `-- texto -->`.
 * - `mindmap`: one central idea and branches nested by indentation.
 *
 * The parser is lenient: it keeps what it understands and reports every other line as an issue, so the editor can
 * render the diagram while it points at the line to fix. Both the catalog (validation) and the web (rendering and
 * editing) use it.
 */

export type NodeShape = 'rect' | 'round' | 'stadium' | 'circle' | 'diamond';
export type LinkLine = 'solid' | 'dotted' | 'thick';

export interface FlowNode {
  id: string;
  text: string;
  shape: NodeShape;
}

export interface FlowLink {
  from: string;
  to: string;
  label: string;
  line: LinkLine;
  /** False for `---`, a line without arrow head. */
  arrow: boolean;
}

/** `LR` draws the flow from left to right (horizontal) and `TD` from top to bottom (vertical). */
export type FlowDirection = 'LR' | 'TD';

export interface FlowModel {
  nodes: FlowNode[];
  links: FlowLink[];
  direction: FlowDirection;
}

/** A line of the text the parser could not use, with a Spanish message for the person who wrote it. */
export interface CodeIssue {
  line: number;
  message: string;
}

export interface FlowParse {
  model: FlowModel;
  issues: CodeIssue[];
}

export interface MindNode {
  text: string;
  shape: NodeShape;
  children: MindNode[];
}

export interface MindParse {
  root: MindNode | null;
  issues: CodeIssue[];
}

/** Largest diagram the components draw legibly. */
export const MAX_FLOW_NODES = 12;
export const MAX_MIND_NODES = 40;
export const MAX_MIND_DEPTH = 4;

const IGNORED = /^(classDef|class|style|linkStyle|click|direction)\b/i;
const HEADER = /^(?:flowchart|graph)\b\s*(TD|TB|BT|LR|RL)?\s*;?$/i;
const ID = /^[A-Za-z_À-ɏ][\wÀ-ɏ]*/;

function unquote(text: string): string {
  const trimmed = text.trim();
  const quoted = /^"(.*)"$/.exec(trimmed);
  return (quoted === null ? trimmed : (quoted[1] ?? '')).replace(/<br\s*\/?>/gi, ' ').trim();
}

/** Text between the brackets that open at `start`, with its shape and the position after the closing bracket. */
function bracketed(source: string, start: number): { text: string; shape: NodeShape; end: number } | null {
  const forms: readonly { open: string; close: string; shape: NodeShape }[] = [
    { open: '((', close: '))', shape: 'circle' },
    { open: '([', close: '])', shape: 'stadium' },
    { open: '[', close: ']', shape: 'rect' },
    { open: '(', close: ')', shape: 'round' },
    { open: '{', close: '}', shape: 'diamond' },
  ];
  for (const form of forms) {
    if (!source.startsWith(form.open, start)) continue;
    const from = start + form.open.length;
    const to = source.indexOf(form.close, from);
    if (to < 0) return null;
    return { text: unquote(source.slice(from, to)), shape: form.shape, end: to + form.close.length };
  }
  return null;
}

interface Scanner {
  readonly source: string;
  position: number;
}

function skipSpaces(scanner: Scanner): void {
  while (scanner.position < scanner.source.length && /\s/.test(scanner.source.charAt(scanner.position))) scanner.position += 1;
}

/** The operator at the scanner position, with its label, or null. */
function operator(scanner: Scanner): { line: LinkLine; arrow: boolean; label: string } | null {
  const rest = scanner.source.slice(scanner.position);
  const labelBefore = /^(--|==|-\.)\s+(.+?)\s+(-->|---|==>|===|\.->|\.-)/.exec(rest);
  if (labelBefore !== null) {
    scanner.position += labelBefore[0].length;
    const end = labelBefore[3] ?? '';
    return { line: end.includes('.') ? 'dotted' : end.startsWith('=') ? 'thick' : 'solid', arrow: end.endsWith('>'), label: unquote(labelBefore[2] ?? '') };
  }
  const plain = /^(-->|---|==>|===|-\.->|-\.-)/.exec(rest);
  if (plain === null) return null;
  scanner.position += plain[0].length;
  const op = plain[0];
  let label = '';
  const piped = /^\s*\|([^|]*)\|/.exec(scanner.source.slice(scanner.position));
  if (piped !== null) {
    label = unquote(piped[1] ?? '');
    scanner.position += piped[0].length;
  }
  return { line: op.includes('.') ? 'dotted' : op.startsWith('=') ? 'thick' : 'solid', arrow: op.endsWith('>'), label };
}

/** Parses a flowchart. Unknown or malformed lines become issues; nodes mentioned only in links are created. */
export function parseFlowchart(code: string): FlowParse {
  const nodes = new Map<string, FlowNode>();
  const links: FlowLink[] = [];
  const issues: CodeIssue[] = [];
  let direction: FlowDirection = 'LR';

  const touch = (id: string, text: string | null, shape: NodeShape | null): void => {
    const known = nodes.get(id);
    if (known === undefined) nodes.set(id, { id, text: text ?? id, shape: shape ?? 'rect' });
    else if (text !== null) {
      known.text = text;
      known.shape = shape ?? known.shape;
    }
  };

  const readNode = (scanner: Scanner): string | null => {
    skipSpaces(scanner);
    const match = ID.exec(scanner.source.slice(scanner.position));
    if (match === null) return null;
    const id = match[0];
    scanner.position += id.length;
    const shaped = bracketed(scanner.source, scanner.position);
    if (shaped !== null) {
      scanner.position = shaped.end;
      touch(id, shaped.text === '' ? id : shaped.text, shaped.shape);
    } else {
      touch(id, null, null);
    }
    return id;
  };

  code.split(/\r?\n/).forEach((raw, index) => {
    const lineNumber = index + 1;
    const line = raw.replace(/%%.*$/, '').trim();
    const header = HEADER.exec(line);
    if (header !== null) {
      // TB and BT read top to bottom, RL left to right: reversed flows are not drawn reversed.
      const given = header[1]?.toUpperCase();
      if (given !== undefined) direction = given === 'LR' || given === 'RL' ? 'LR' : 'TD';
      return;
    }
    if (line === '' || IGNORED.test(line)) return;
    if (/^(subgraph|end)\b/i.test(line)) {
      issues.push({ line: lineNumber, message: 'Los subgrupos (subgraph) no están disponibles.' });
      return;
    }
    for (const statement of line.split(';')) {
      const scanner: Scanner = { source: statement.trim(), position: 0 };
      if (scanner.source === '') continue;
      let previous = readNode(scanner);
      if (previous === null) {
        issues.push({ line: lineNumber, message: `No se entiende «${scanner.source}»; un nodo empieza con su nombre, por ejemplo A[Texto].` });
        continue;
      }
      skipSpaces(scanner);
      while (scanner.position < scanner.source.length) {
        const op = operator(scanner);
        if (op === null) {
          issues.push({ line: lineNumber, message: `No se entiende «${scanner.source.slice(scanner.position)}»; une los nodos con --> o ---.` });
          break;
        }
        const next = readNode(scanner);
        if (next === null) {
          issues.push({ line: lineNumber, message: 'Falta el nodo de destino después de la flecha.' });
          break;
        }
        links.push({ from: previous, to: next, label: op.label, line: op.line, arrow: op.arrow });
        previous = next;
        skipSpaces(scanner);
      }
    }
  });

  if (nodes.size > MAX_FLOW_NODES) issues.push({ line: 1, message: `El diagrama admite hasta ${String(MAX_FLOW_NODES)} nodos.` });
  return { model: { nodes: [...nodes.values()], links, direction }, issues };
}

/** Text that survives a round trip through `parseFlowchart` inside brackets. */
function quoteText(text: string): string {
  const clean = text.replace(/"/g, "'").replace(/\s+/g, ' ').trim();
  return /[[\](){}|;]/.test(clean) || clean === '' ? `"${clean}"` : clean;
}

const OPEN: Readonly<Record<NodeShape, readonly [string, string]>> = {
  rect: ['[', ']'],
  round: ['(', ')'],
  stadium: ['([', '])'],
  circle: ['((', '))'],
  diamond: ['{', '}'],
};

/** Mermaid text of a flowchart: one line per node, then one per link. */
export function flowchartToCode(model: FlowModel, direction: FlowDirection = model.direction): string {
  const lines = [`flowchart ${direction}`];
  for (const node of model.nodes) {
    const [open, close] = OPEN[node.shape];
    lines.push(`  ${node.id}${open}${quoteText(node.text)}${close}`);
  }
  for (const link of model.links) {
    const op = link.line === 'dotted' ? (link.arrow ? '-.->' : '-.-') : link.line === 'thick' ? (link.arrow ? '==>' : '===') : link.arrow ? '-->' : '---';
    lines.push(`  ${link.from} ${op}${link.label === '' ? '' : `|${quoteText(link.label)}|`} ${link.to}`);
  }
  return lines.join('\n');
}

/** Next free node name: A, B… Z, then N27, N28… */
export function nextNodeId(existing: readonly string[]): string {
  for (let code = 65; code <= 90; code += 1) {
    const candidate = String.fromCharCode(code);
    if (!existing.includes(candidate)) return candidate;
  }
  let number = existing.length + 1;
  while (existing.includes(`N${String(number)}`)) number += 1;
  return `N${String(number)}`;
}

/** Flowchart model of the `nodes` and `edges` props that diagrams had before they were written as text. */
export function legacyFlow(nodes: readonly { id: string; text: string }[], edges: readonly { from: string; to: string }[]): FlowModel {
  return {
    nodes: nodes.map((node) => ({ id: node.id, text: node.text, shape: 'rect' as const })),
    links: edges.map((edge) => ({ from: edge.from, to: edge.to, label: '', line: 'solid' as const, arrow: true })),
    direction: 'LR',
  };
}

// --- Mind map ---------------------------------------------------------------------------------------------------

const SHAPES: readonly { pattern: RegExp; shape: NodeShape }[] = [
  { pattern: /^[\w-]*\(\((.*)\)\)$/, shape: 'circle' },
  { pattern: /^[\w-]*\)\)(.*)\(\($/, shape: 'circle' },
  { pattern: /^[\w-]*\{\{(.*)\}\}$/, shape: 'diamond' },
  { pattern: /^[\w-]*\[(.*)\]$/, shape: 'rect' },
  { pattern: /^[\w-]*\((.*)\)$/, shape: 'round' },
];

function mindText(raw: string): { text: string; shape: NodeShape } {
  const text = raw.replace(/:::[\w-]+/g, '').trim();
  for (const { pattern, shape } of SHAPES) {
    const match = pattern.exec(text);
    if (match !== null) return { text: unquote(match[1] ?? ''), shape };
  }
  return { text: unquote(text), shape: 'rect' };
}

/** Parses a mind map: the first node is the central idea and indentation nests the rest. */
export function parseMindmap(code: string): MindParse {
  const issues: CodeIssue[] = [];
  const state: { root: MindNode | null } = { root: null };
  const stack: { indent: number; node: MindNode; depth: number }[] = [];
  let count = 0;
  let sawHeader = false;

  code.split(/\r?\n/).forEach((raw, index) => {
    const lineNumber = index + 1;
    const stripped = raw.replace(/%%.*$/, '').replace(/\t/g, '    ');
    if (stripped.trim() === '') return;
    if (!sawHeader && /^\s*mindmap\s*$/i.test(stripped)) {
      sawHeader = true;
      return;
    }
    sawHeader = true;
    if (/^\s*::icon\(/.test(stripped)) return;
    const indent = stripped.length - stripped.trimStart().length;
    const { text, shape } = mindText(stripped);
    if (text === '') {
      issues.push({ line: lineNumber, message: 'Hay un nodo sin texto.' });
      return;
    }
    const node: MindNode = { text, shape, children: [] };
    count += 1;
    if (state.root === null) {
      state.root = node;
      stack.push({ indent, node, depth: 0 });
      return;
    }
    while (stack.length > 0 && (stack[stack.length - 1]?.indent ?? 0) >= indent) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent === undefined) {
      issues.push({ line: lineNumber, message: 'Solo puede haber una idea central: sangra este nodo bajo ella.' });
      return;
    }
    const depth = parent.depth + 1;
    if (depth > MAX_MIND_DEPTH) {
      issues.push({ line: lineNumber, message: `El mapa admite hasta ${String(MAX_MIND_DEPTH)} niveles bajo la idea central.` });
      return;
    }
    parent.node.children.push(node);
    stack.push({ indent, node, depth });
  });

  if (state.root === null) issues.push({ line: 1, message: 'Falta la idea central.' });
  if (count > MAX_MIND_NODES) issues.push({ line: 1, message: `El mapa admite hasta ${String(MAX_MIND_NODES)} nodos.` });
  return { root: state.root, issues };
}

/** Mermaid text of a mind map. */
export function mindmapToCode(root: MindNode): string {
  const lines = ['mindmap', `  root((${quoteText(root.text)}))`];
  const walk = (node: MindNode, depth: number): void => {
    for (const child of node.children) {
      lines.push(`${'  '.repeat(depth + 1)}${quoteText(child.text)}`);
      walk(child, depth + 1);
    }
  };
  walk(root, 1);
  return lines.join('\n');
}

/** Mind map of the `center` and `branches` props that mind maps had before they were written as text. */
export function legacyMind(center: string, branches: readonly { text: string; emoji?: string; details: readonly string[] }[]): MindNode {
  return {
    text: center,
    shape: 'circle',
    children: branches.map((branch) => ({
      text: `${branch.emoji !== undefined && branch.emoji !== '' ? `${branch.emoji} ` : ''}${branch.text}`,
      shape: 'rect' as const,
      children: branch.details.map((detail) => ({ text: detail, shape: 'rect' as const, children: [] })),
    })),
  };
}

/** Emoji at the start of a text, split from the rest: "☀️ Solar" gives "☀️" and "Solar". */
export function leadingEmoji(text: string): { emoji: string; rest: string } {
  const match = /^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*)\s*(.*)$/u.exec(text.trim());
  return match === null ? { emoji: '', rest: text.trim() } : { emoji: match[1] ?? '', rest: match[2] ?? '' };
}
