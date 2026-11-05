import { list, num, rec, str } from '../../api/decode.ts';
import { fieldLabel } from './prop-labels.ts';

/** Longest text that still fits a single-line input; longer limits get a text area. */
export const SHORT_TEXT_MAX = 200;

interface FieldBase {
  key: string;
  label: string;
  required: boolean;
}

export type FieldDescriptor =
  | (FieldBase & { kind: 'text'; maxLength: number | null; multiline: boolean })
  | (FieldBase & { kind: 'number'; min: number | null; max: number | null; integer: boolean })
  | (FieldBase & { kind: 'boolean' })
  | (FieldBase & { kind: 'enum'; options: string[] })
  | (FieldBase & { kind: 'string-list'; minItems: number; maxItems: number | null; itemMaxLength: number | null })
  | (FieldBase & { kind: 'object-list'; minItems: number; maxItems: number | null; fields: FieldDescriptor[] })
  | (FieldBase & { kind: 'grid'; minItems: number; maxItems: number | null })
  | (FieldBase & { kind: 'media' });

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

function describeNode(key: string, node: Record<string, unknown>, required: boolean): FieldDescriptor {
  const base = { key, label: fieldLabel(key, str(node.description) || key), required };
  if (isNullable(node) && isUuid(node)) return { ...base, kind: 'media' };
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
      return { ...base, kind: 'string-list', minItems, maxItems, itemMaxLength: optionalNumber(items.maxLength) };
    }
    default: {
      const maxLength = optionalNumber(node.maxLength);
      return { ...base, kind: 'text', maxLength, multiline: maxLength !== null && maxLength > SHORT_TEXT_MAX };
    }
  }
}

/** Builds the form fields of an object schema, in property order. */
export function describeSchema(schema: Record<string, unknown>): FieldDescriptor[] {
  const required = new Set(list(schema.required).map((name) => str(name)));
  return Object.entries(rec(schema.properties)).map(([key, node]) => describeNode(key, rec(node), required.has(key)));
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
        item[field.key] = field.options[0] ?? '';
        break;
      case 'media':
        item[field.key] = null;
        break;
      default:
        item[field.key] = [];
    }
  }
  return item;
}
