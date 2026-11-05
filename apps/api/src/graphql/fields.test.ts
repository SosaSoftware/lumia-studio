import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PERMISSION_CATALOG } from '../auth/index.ts';
import { STUDIO_FIELDS } from './fields.ts';
import { STUDIO_SCHEMA_PATH } from './schema.ts';

const ACTIONS = new Set(PERMISSION_CATALOG.map((permission) => permission.key));

/** Field names of the root types, read from the schema text. */
function schemaFields(): string[] {
  const text = readFileSync(STUDIO_SCHEMA_PATH, 'utf8');
  const names: string[] = [];
  for (const root of ['Query', 'Mutation']) {
    const block = new RegExp(`type ${root} \\{([\\s\\S]*?)\\n\\}`).exec(text)?.[1] ?? '';
    for (const line of block.split('\n')) {
      const match = /^ {2}([a-zA-Z]+)[(:]/.exec(line);
      if (match?.[1] !== undefined) names.push(`${root}.${match[1]}`);
    }
  }
  return names;
}

describe('STUDIO_FIELDS', () => {
  it('covers every query and mutation of the schema exactly once (subscriptions have no handler)', () => {
    const declared = STUDIO_FIELDS.map((field) => `${field.type}.${field.field}`);
    expect(declared.sort()).toEqual(schemaFields().sort());
  });

  it('gives every field a Studio action', () => {
    for (const field of STUDIO_FIELDS) {
      expect(ACTIONS.has(field.action ?? '')).toBe(true);
    }
  });

  it('uses the action of each group', () => {
    const action = (name: string): string | null => STUDIO_FIELDS.find((field) => field.field === name)?.action ?? null;
    expect(action('createMediaUpload')).toBe('media.upload');
    expect(action('registerMedia')).toBe('media.upload');
    expect(action('generateNarration')).toBe('narration.generate');
    expect(action('publishVersion')).toBe('documents.publish');
    expect(action('saveElement')).toBe('documents.edit');
    expect(action('treeNodes')).toBe('documents.view');
  });

  it('scopes every field by a record of the tree, except the lists filtered by the claims, the shared catalogs and the own access', () => {
    const unscoped = STUDIO_FIELDS.filter((field) => field.resource === undefined).map((field) => field.field);
    expect(unscoped.sort()).toEqual(['categories', 'componentCatalog', 'me', 'narrationVoices']);
    expect(STUDIO_FIELDS.find((field) => field.field === 'document')?.resource).toEqual({ type: 'node', idArg: 'nodeId' });
    expect(STUDIO_FIELDS.find((field) => field.field === 'mediaLibrary')?.resource).toEqual({ type: 'category', idArg: 'filter.categoryId' });
  });
});
