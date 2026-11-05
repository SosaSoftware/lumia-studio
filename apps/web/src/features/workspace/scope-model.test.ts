import { describe, expect, it } from 'vitest';
import { groupByName } from './scope-model.ts';

describe('groupByName', () => {
  it('lists the items under their group, groups in the order of their first item, and items without a group first', () => {
    const items = [
      { id: 'instituto-a', groupName: 'Institutos' },
      { id: 'suelta', groupName: null },
      { id: 'academia', groupName: 'Academias' },
      { id: 'instituto-b', groupName: 'Institutos' },
    ];
    expect(groupByName(items).map((group) => [group.name, group.items.map((item) => item.id)])).toEqual([
      [null, ['suelta']],
      ['Institutos', ['instituto-a', 'instituto-b']],
      ['Academias', ['academia']],
    ]);
  });
});
