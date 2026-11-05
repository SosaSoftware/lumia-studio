import { z } from 'zod';
import { list, optionalNum, optionalText, record } from './decode.ts';

/**
 * JSON Schema subset of the AgentCore Gateway tool definitions for Lambda targets: `type`, `description`,
 * `properties`, `required` and `items`. Enums, ranges and defaults travel in the description.
 */
export interface GatewaySchema {
  readonly type: GatewaySchemaType;
  readonly description?: string;
  readonly properties?: Readonly<Record<string, GatewaySchema>>;
  readonly required?: readonly string[];
  readonly items?: GatewaySchema;
}

export type GatewaySchemaType = 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean';

const TYPES: readonly GatewaySchemaType[] = ['object', 'array', 'string', 'number', 'integer', 'boolean'];

/** Tool definition of a Lambda target, as the gateway takes it inline. */
export interface GatewayToolSchema {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: GatewaySchema;
}

/** Converts a zod input schema (as the caller writes it, with defaults optional) to the gateway subset. */
export function toGatewaySchema(schema: z.ZodType): GatewaySchema {
  const converted = sanitize(z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }));
  return converted.type === 'object' ? converted : { type: 'object', properties: { value: converted }, required: ['value'] };
}

function sanitize(value: unknown): GatewaySchema {
  const node = record(value);
  const branches = list(node.anyOf ?? node.oneOf).map(record);
  if (branches.length > 0) {
    // Nullable fields become `anyOf: [X, null]`: the caller may leave them out, so only X stays.
    const concrete = branches.filter((branch) => branch.type !== 'null');
    const [only] = concrete;
    const merged = concrete.length === 1 && only !== undefined ? { ...only, description: node.description ?? only.description } : { type: 'object', description: node.description };
    return sanitize(merged);
  }
  const values = list(node.enum);
  const type = values.length > 0 ? (typeof values[0] === 'number' ? 'number' : 'string') : typeOf(node);
  const description = [optionalText(node.description), ...notes(node, values)].filter((part): part is string => part !== null && part !== '').join(' ');
  const base: { type: GatewaySchemaType; description?: string } = description === '' ? { type } : { type, description };
  if (type === 'array') {
    return { ...base, items: sanitize(node.items ?? { type: 'string' }) };
  }
  if (type !== 'object') {
    return base;
  }
  const properties = record(node.properties);
  const names = Object.keys(properties);
  if (names.length === 0) {
    return base;
  }
  const required = list(node.required).filter((name): name is string => typeof name === 'string' && names.includes(name));
  return {
    ...base,
    properties: Object.fromEntries(names.map((name) => [name, sanitize(properties[name])])),
    ...(required.length === 0 ? {} : { required }),
  };
}

function typeOf(node: Record<string, unknown>): GatewaySchemaType {
  const raw = Array.isArray(node.type) ? list(node.type).find((candidate) => candidate !== 'null') : node.type;
  return TYPES.find((candidate) => candidate === raw) ?? 'object';
}

/** What the subset cannot express, in words the model reads. */
function notes(node: Record<string, unknown>, values: readonly unknown[]): string[] {
  const result: string[] = [];
  if (values.length > 0) result.push(`Valores: ${values.map((option) => JSON.stringify(option)).join(', ')}.`);
  const minimum = optionalNum(node.minimum);
  const maximum = optionalNum(node.maximum);
  if (minimum !== null && maximum !== null) result.push(`Entre ${String(minimum)} y ${String(maximum)}.`);
  else if (minimum !== null) result.push(`Mínimo ${String(minimum)}.`);
  else if (maximum !== null) result.push(`Máximo ${String(maximum)}.`);
  const minItems = optionalNum(node.minItems);
  const maxItems = optionalNum(node.maxItems);
  if (minItems !== null && maxItems !== null) result.push(`De ${String(minItems)} a ${String(maxItems)} elementos.`);
  else if (minItems !== null) result.push(`Al menos ${String(minItems)} elemento(s).`);
  const maxLength = optionalNum(node.maxLength);
  if (maxLength !== null) result.push(`Hasta ${String(maxLength)} caracteres.`);
  if (node.default !== undefined) result.push(`Por defecto: ${JSON.stringify(node.default)}.`);
  return result;
}
