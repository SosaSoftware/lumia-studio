import { describe, expect, it } from 'vitest';
import { ScriptedDatabase } from '../../test/support/scripted-database.ts';
import { StudioResourceLookup } from './studio-resource-lookup.ts';

const ID = '3f2b8f0e-6a1d-4c57-9e1a-2d6a4b0c9f11';

describe('StudioResourceLookup', () => {
  it('returns the category and subcategory of every record of a tree', async () => {
    const db = new ScriptedDatabase([{ match: 'studio.subcategory s', rows: [{ category_id: 'c1', subcategory_id: 's1' }] }]);
    const lookup = new StudioResourceLookup(db);
    for (const type of ['subcategory', 'node', 'document', 'version', 'slide', 'element', 'pause', 'audio', 'narration', 'comment']) {
      await expect(lookup.attributes(type, ID)).resolves.toEqual({ category: 'c1', subcategory: 's1' });
    }
  });

  it('returns only the category of a category', async () => {
    const db = new ScriptedDatabase([{ match: 'from studio.category c', rows: [{ category_id: 'c1', subcategory_id: null }] }]);
    await expect(new StudioResourceLookup(db).attributes('category', ID)).resolves.toEqual({ category: 'c1' });
  });

  it('returns null for a missing record, an unknown type or a malformed id without querying', async () => {
    const db = new ScriptedDatabase();
    const lookup = new StudioResourceLookup(db);
    await expect(lookup.attributes('slide', ID)).resolves.toBeNull();
    await expect(lookup.attributes('unknown', ID)).resolves.toBeNull();
    await expect(lookup.attributes('slide', "x'; drop table")).resolves.toBeNull();
    expect(db.statements).toHaveLength(1);
  });
});
