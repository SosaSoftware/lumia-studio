import type { Message, ToolResultBlock } from '@strands-agents/sdk';

/** A JSON object. */
export type JsonObject = Record<string, unknown>;

/** Whether a value is a plain JSON object. */
export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Index of the message that opened the current turn: the last message the person wrote. Messages that only
 * carry tool results also have the user role, so they do not count.
 *
 * @returns The index, or -1 when the person has not written yet.
 */
export function turnStart(messages: readonly Message[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'user' && message.content.some((block) => block.type === 'textBlock') && !message.content.some((block) => block.type === 'toolResultBlock')) {
      return index;
    }
  }
  return -1;
}

/** The JSON a tool answered: its JSON block, or its first text block when that text is JSON. */
export function toolResultJson(block: ToolResultBlock): unknown {
  for (const item of block.content) {
    if (item.type === 'jsonBlock') {
      return item.json;
    }
    if (item.type === 'textBlock') {
      try {
        const parsed: unknown = JSON.parse(item.text);
        return parsed;
      } catch {
        // Plain text, such as the adapter's placeholder: there is no JSON answer.
        return undefined;
      }
    }
  }
  return undefined;
}

/** JSON with object keys sorted at every level, so equal values compare equal whatever their key order. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (isJsonObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, sortKeys(value[key])]),
    );
  }
  return value;
}

/** Replaces, at any depth, every string that is a key of `ids` with its value. */
export function translateIds(value: unknown, ids: Readonly<Record<string, string>>): unknown {
  if (typeof value === 'string') {
    return Object.hasOwn(ids, value) ? ids[value] : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => translateIds(item, ids));
  }
  if (isJsonObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, translateIds(item, ids)]));
  }
  return value;
}
