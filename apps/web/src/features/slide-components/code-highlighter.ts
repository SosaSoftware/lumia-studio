/** Kind of a piece of code, mapped to a color by the code block. */
export type CodeTokenKind = 'plain' | 'keyword' | 'string' | 'number' | 'comment' | 'function' | 'tag' | 'punctuation';

export interface CodeToken {
  kind: CodeTokenKind;
  text: string;
}

interface Grammar {
  /** Start of a line comment, or null when the language has none. */
  readonly lineComment: RegExp | null;
  readonly keywords: ReadonlySet<string>;
  readonly ignoreCase: boolean;
}

function words(text: string): ReadonlySet<string> {
  return new Set(text.split(' '));
}

const GRAMMARS: Readonly<Record<string, Grammar>> = {
  javascript: {
    lineComment: /^\/\//,
    keywords: words('const let var function return if else for while do switch case break continue new class extends import from export default async await try catch finally throw typeof instanceof in of this null undefined true false'),
    ignoreCase: false,
  },
  python: {
    lineComment: /^#/,
    keywords: words('def return if elif else for while in not and or is import from as class try except finally raise with lambda pass break continue global yield True False None print'),
    ignoreCase: false,
  },
  css: { lineComment: null, keywords: words('important media keyframes from to'), ignoreCase: false },
  json: { lineComment: null, keywords: words('true false null'), ignoreCase: false },
  sql: {
    lineComment: /^--/,
    keywords: words('select from where and or not insert into values update set delete create table drop alter join left right inner outer on group by order having limit as distinct count sum avg min max null primary key'),
    ignoreCase: true,
  },
};

/**
 * Splits code into colored tokens. The tokenizer is deliberately small: it recognizes comments, strings, numbers,
 * keywords, calls and markup tags, which is enough for the short snippets of a slide.
 */
export class CodeHighlighter {
  public constructor(private readonly language: string) {}

  /** Tokens of each line of `code`. */
  public highlight(code: string): CodeToken[][] {
    return code.replace(/\r\n?/g, '\n').split('\n').map((line) => this.highlightLine(line));
  }

  private highlightLine(line: string): CodeToken[] {
    if (this.language === 'text') return [{ kind: 'plain', text: line }];
    if (this.language === 'html') return this.highlightMarkup(line);
    const grammar = GRAMMARS[this.language];
    if (grammar === undefined) return [{ kind: 'plain', text: line }];
    const tokens: CodeToken[] = [];
    let rest = line;
    while (rest !== '') {
      const token = this.nextToken(rest, grammar);
      tokens.push(token);
      rest = rest.slice(token.text.length);
    }
    return tokens;
  }

  private nextToken(rest: string, grammar: Grammar): CodeToken {
    if (grammar.lineComment?.test(rest) === true) return { kind: 'comment', text: rest };
    const block = /^\/\*.*?(\*\/|$)/.exec(rest);
    if (block !== null) return { kind: 'comment', text: block[0] };
    const quoted = /^(["'`])(?:\\.|(?!\1).)*(\1|$)/.exec(rest);
    if (quoted !== null) return { kind: 'string', text: quoted[0] };
    const numeric = /^\d+(\.\d+)?/.exec(rest);
    if (numeric !== null) return { kind: 'number', text: numeric[0] };
    const word = /^[A-Za-z_$][\w$]*/.exec(rest);
    if (word !== null) {
      const name = word[0];
      if (grammar.keywords.has(grammar.ignoreCase ? name.toLowerCase() : name)) return { kind: 'keyword', text: name };
      return { kind: /^\s*\(/.test(rest.slice(name.length)) ? 'function' : 'plain', text: name };
    }
    const space = /^\s+/.exec(rest);
    if (space !== null) return { kind: 'plain', text: space[0] };
    return { kind: 'punctuation', text: rest.charAt(0) };
  }

  private highlightMarkup(line: string): CodeToken[] {
    const tokens: CodeToken[] = [];
    const pattern = /(<!--.*?(?:-->|$))|(<\/?[A-Za-z][\w-]*)|("[^"]*"|'[^']*')|(\/?>)/g;
    let cursor = 0;
    for (const match of line.matchAll(pattern)) {
      if (match.index > cursor) tokens.push({ kind: 'plain', text: line.slice(cursor, match.index) });
      const kind: CodeTokenKind = match[1] !== undefined ? 'comment' : match[3] !== undefined ? 'string' : 'tag';
      tokens.push({ kind, text: match[0] });
      cursor = match.index + match[0].length;
    }
    if (cursor < line.length) tokens.push({ kind: 'plain', text: line.slice(cursor) });
    return tokens;
  }
}
