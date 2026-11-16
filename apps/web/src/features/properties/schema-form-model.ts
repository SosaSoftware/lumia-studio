import { list, num, rec, str } from '../../api/decode.ts';
import { fieldLabel } from './prop-labels.ts';

/** Colors that new list items take in turn, so a new bar or segment does not repeat the previous one. */
const NEW_ITEM_COLORS: readonly string[] = ['primary', 'purple', 'pink', 'orange', 'warning', 'success', 'accent', 'danger'];

/** Longest text that still fits a single-line input; longer limits get a text area. */
export const SHORT_TEXT_MAX = 200;

/** Field whose value is the id of something else: an item of a list of the same element, or another element of the slide. */
export type FieldRef =
  | { kind: 'list'; list: string; value: string; label: string; letters: boolean }
  | { kind: 'slideElements' }
  /** A slide of the class by its number; with `when`, only while another prop of the element has that value. */
  | { kind: 'slides'; when: { prop: string; value: unknown } | null };

/** Control that replaces the generic one: a shape picker, an icon grid or the table editor. */
export type FieldControl = 'shape' | 'icon' | 'table';

interface FieldBase {
  key: string;
  label: string;
  /** Short help under the label; empty for none. */
  help: string;
  required: boolean;
  ref: FieldRef | null;
  control: FieldControl | null;
  /** The value is generated (ids of list items): the field is kept for new items but never shown. */
  auto: boolean;
}

export type FieldDescriptor =
  | (FieldBase & { kind: 'text'; maxLength: number | null; multiline: boolean })
  | (FieldBase & { kind: 'number'; min: number | null; max: number | null; integer: boolean })
  | (FieldBase & { kind: 'boolean' })
  | (FieldBase & { kind: 'enum'; options: string[] })
  | (FieldBase & { kind: 'emoji'; set: EmojiSetName })
  | (FieldBase & { kind: 'code'; editor: string; maxLength: number | null })
  | (FieldBase & { kind: 'string-list'; minItems: number; maxItems: number | null; itemMaxLength: number | null; itemEmojiSet: EmojiSetName | null })
  | (FieldBase & { kind: 'object-list'; minItems: number; maxItems: number | null; fields: FieldDescriptor[] })
  | (FieldBase & { kind: 'grid'; minItems: number; maxItems: number | null })
  | (FieldBase & { kind: 'media'; accept: string });

/** Emojis a field offers: any emoji, or only people, animals and fantasy characters. */
export type EmojiSetName = 'general' | 'characters';

function emojiSetOf(value: unknown): EmojiSetName | null {
  return value === 'general' || value === 'characters' ? value : null;
}

export type FieldPath = readonly (string | number)[];

function optionalNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function isNullable(node: Record<string, unknown>): boolean {
  return list(node.anyOf).some((option) => rec(option).type === 'null');
}

function isUuid(node: Record<string, unknown>): boolean {
  return list(node.anyOf).some((option) => rec(option).format === 'uuid');
}

function refOf(value: unknown): FieldRef | null {
  const ref = rec(value);
  if (ref.slideElements === true) return { kind: 'slideElements' };
  if (ref.slides === true) {
    const when = rec(ref.when);
    return { kind: 'slides', when: str(when.prop) === '' ? null : { prop: str(when.prop), value: when.value } };
  }
  const listKey = str(ref.list);
  return listKey === '' ? null : { kind: 'list', list: listKey, value: str(ref.value, 'id'), label: str(ref.label, 'text'), letters: ref.letters === true };
}

function controlOf(value: unknown): FieldControl | null {
  return value === 'shape' || value === 'icon' || value === 'table' ? value : null;
}

function describeNode(key: string, node: Record<string, unknown>, required: boolean): FieldDescriptor {
  const base = { key, label: fieldLabel(key, str(node.description) || key), help: '', required, ref: refOf(node.ref), control: controlOf(node.control), auto: node.auto === true };
  if (isNullable(node) && isUuid(node)) return { ...base, kind: 'media', accept: str(node.accept, 'image/*') };
  const options = list(node.enum).filter((option): option is string => typeof option === 'string');
  if (options.length > 0) return { ...base, kind: 'enum', options };
  switch (node.type) {
    case 'boolean':
      return { ...base, kind: 'boolean' };
    case 'number':
    case 'integer':
      return { ...base, kind: 'number', min: optionalNumber(node.minimum), max: optionalNumber(node.maximum), integer: node.type === 'integer' };
    case 'array': {
      const items = rec(node.items);
      const minItems = num(node.minItems, 0);
      const maxItems = optionalNumber(node.maxItems);
      if (items.type === 'object') return { ...base, kind: 'object-list', minItems, maxItems, fields: describeSchema(items) };
      if (items.type === 'array') return { ...base, kind: 'grid', minItems, maxItems };
      return { ...base, kind: 'string-list', minItems, maxItems, itemMaxLength: optionalNumber(items.maxLength), itemEmojiSet: emojiSetOf(items.emojiSet) };
    }
    default: {
      const emojiSet = emojiSetOf(node.emojiSet);
      if (emojiSet !== null) return { ...base, kind: 'emoji', set: emojiSet };
      if (typeof node.editor === 'string') return { ...base, kind: 'code', editor: node.editor, maxLength: optionalNumber(node.maxLength) };
      const maxLength = optionalNumber(node.maxLength);
      return { ...base, kind: 'text', maxLength, multiline: maxLength !== null && maxLength > SHORT_TEXT_MAX };
    }
  }
}

/** Builds the form fields of an object schema, in property order. Generated fields (`auto`) are kept so new list items get them. */
export function describeSchema(schema: Record<string, unknown>): FieldDescriptor[] {
  const required = new Set(list(schema.required).map((name) => str(name)));
  return Object.entries(rec(schema.properties))
    .filter(([, node]) => rec(node).hidden !== true)
    .map(([key, node]) => describeNode(key, rec(node), required.has(key)));
}

/** Value of a nested path, or undefined when it does not exist. */
export function getAtPath(value: unknown, path: FieldPath): unknown {
  let current: unknown = value;
  for (const part of path) {
    if (Array.isArray(current) && typeof part === 'number') current = current[part];
    else if (typeof current === 'object' && current !== null && typeof part === 'string') current = rec(current)[part];
    else return undefined;
  }
  return current;
}

/** Returns a copy of `value` with `next` at `path`; the original is not modified. */
export function setAtPath(value: unknown, path: FieldPath, next: unknown): unknown {
  const [head, ...rest] = path;
  if (head === undefined) return next;
  if (typeof head === 'number') {
    const copy = list(value);
    copy[head] = setAtPath(copy[head], rest, next);
    return copy;
  }
  const record = rec(value);
  return { ...record, [head]: setAtPath(record[head], rest, next) };
}

/** Error path used by the API for a field, relative to the props (`options.0.text`). */
export function errorKey(path: FieldPath): string {
  return path.map(String).join('.');
}

/** Next unused single-letter id (a, b, c…) for list items that have an `id`. */
export function nextLetterId(existing: readonly string[]): string {
  for (let code = 97; code <= 122; code += 1) {
    const candidate = String.fromCharCode(code);
    if (!existing.includes(candidate)) return candidate;
  }
  return `x${String(existing.length + 1)}`;
}

/** Placeholder text of a new entry of a list of texts, valid for the limits of that list. */
export function newListText(component: string, key: string, maxLength: number | null): string {
  if (component === 'word_search') return 'PALABRA';
  if (key === 'elements') return '⭐';
  return maxLength !== null && maxLength < 14 ? 'Nuevo' : 'Nuevo elemento';
}

/** A new list item with valid placeholder values for each field. */
export function blankItem(fields: readonly FieldDescriptor[], existing: readonly unknown[]): Record<string, unknown> {
  const item: Record<string, unknown> = {};
  for (const field of fields) {
    switch (field.kind) {
      case 'text':
        item[field.key] =
          field.key === 'id' ? nextLetterId(existing.map((entry) => str(rec(entry).id))) : field.key === 'text' ? `Opción ${String(existing.length + 1)}` : 'Texto';
        break;
      case 'number':
        item[field.key] = field.min ?? 0;
        break;
      case 'boolean':
        item[field.key] = false;
        break;
      case 'enum':
        // A new item of a list that paints every item differently takes the next vivid color instead of the first key.
        item[field.key] = field.options.includes('primary') && field.options.includes('surface') ? (NEW_ITEM_COLORS[existing.length % NEW_ITEM_COLORS.length] ?? 'primary') : (field.options[0] ?? '');
        break;
      case 'media':
        item[field.key] = null;
        break;
      case 'emoji':
        item[field.key] = field.set === 'characters' ? '🧑' : '⭐';
        break;
      case 'code':
        item[field.key] = '';
        break;
      case 'string-list':
        item[field.key] = Array.from({ length: field.minItems }, () => newListText('', field.key, field.itemMaxLength));
        break;
      default:
        item[field.key] = [];
    }
  }
  return item;
}

/** Returns a copy of `items` with the item at `from` moved to `to`; out-of-range indexes return an unchanged copy. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const copy = [...items];
  if (from < 0 || from >= copy.length || to < 0 || to >= copy.length) return copy;
  const [moved] = copy.splice(from, 1);
  if (moved !== undefined) copy.splice(to, 0, moved);
  return copy;
}
