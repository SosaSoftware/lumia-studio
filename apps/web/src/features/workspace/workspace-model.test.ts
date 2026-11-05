import { describe, expect, it } from 'vitest';
import type { Category, TreeNode } from '../../api/types.ts';
import { NO_FILTERS, ancestorsOf, buildTree, countClasses, defaultExpanded, filterTree, flattenTree, pathTo } from '../tree/tree-model.ts';
import { badgeOf, findSubcategory, resolveScope } from './scope-model.ts';
import { parseStatusFilter, readScope, readTabs } from './workspace-store.ts';

function node(id: string, parentId: string | null, kind: 'folder' | 'class', displayName: string, position: number, extra: Partial<TreeNode> = {}): TreeNode {
  return {
    id,
    subcategoryId: 'sub-ai',
    parentId,
    kind,
    name: kind === 'class' ? `${id}.lumia` : id,
    displayName,
    description: '',
    position,
    documentId: null,
    documentStatus: kind === 'class' ? 'no_content' : null,
    currentVersion: null,
    publishedVersion: null,
    ...extra,
  };
}

/** fundamentos/ (que-es-la-ia, datos/ (tipos)), uso/ (privacidad), repaso */
const NODES: TreeNode[] = [
  node('repaso', null, 'class', 'Repaso general', 3, { documentStatus: 'published', currentVersion: 1, publishedVersion: 1 }),
  node('uso', null, 'folder', 'Uso responsable', 2),
  node('fundamentos', null, 'folder', 'Fundamentos', 1, { description: 'Conceptos básicos' }),
  node('datos', 'fundamentos', 'folder', 'Los datos', 2),
  node('que-es-la-ia', 'fundamentos', 'class', '¿Qué es la IA?', 1, { documentStatus: 'draft', currentVersion: 1 }),
  node('tipos', 'datos', 'class', 'Tipos de datos', 1),
  node('privacidad', 'uso', 'class', 'Información personal', 1),
];

const CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'academia', displayName: 'Academia Lumia', description: '', groupName: null, subcategories: [{ id: 'sub-ai', categoryId: 'cat-1', name: 'ia', displayName: 'Inteligencia artificial', description: '', groupName: null }] },
  { id: 'cat-2', name: 'vacia', displayName: 'Vacía', description: '', groupName: null, subcategories: [] },
  { id: 'cat-3', name: 'ciencias', displayName: 'Escuela de Ciencias', description: '', groupName: null, subcategories: [{ id: 'sub-bio', categoryId: 'cat-3', name: 'biologia', displayName: 'Biología', description: '', groupName: null }] },
];

describe('tree model', () => {
  it('builds folders and classes from the flat list, siblings by position', () => {
    const tree = buildTree(NODES);
    expect(tree.map((item) => item.node.displayName)).toEqual(['Fundamentos', 'Uso responsable', 'Repaso general']);
    expect(tree[0]?.children.map((item) => item.node.displayName)).toEqual(['¿Qué es la IA?', 'Los datos']);
    expect(tree[0] === undefined ? 0 : countClasses(tree[0])).toBe(2);
  });

  it('shows only the rows of expanded folders and opens the first chain down to a class', () => {
    const tree = buildTree(NODES);
    const expanded = defaultExpanded(tree);
    expect([...expanded]).toEqual(['fundamentos']);
    expect(flattenTree(tree, expanded).map((row) => [row.item.node.id, row.level])).toEqual([
      ['fundamentos', 1], ['que-es-la-ia', 2], ['datos', 2], ['uso', 1], ['repaso', 1],
    ]);
    expect(flattenTree(tree, new Set(), true)).toHaveLength(NODES.length);
  });

  it('filters classes by status and text and keeps the folders on their way', () => {
    const tree = buildTree(NODES);
    const drafts = filterTree(tree, { ...NO_FILTERS, status: 'draft' });
    expect(flattenTree(drafts, new Set(), true).map((row) => row.item.node.id)).toEqual(['fundamentos', 'que-es-la-ia']);
    const byText = filterTree(tree, { status: 'all', text: 'informacion' });
    expect(flattenTree(byText, new Set(), true).map((row) => row.item.node.id)).toEqual(['uso', 'privacidad']);
    const byFolder = filterTree(tree, { status: 'all', text: 'datos' });
    expect(flattenTree(byFolder, new Set(), true).map((row) => row.item.node.id)).toEqual(['fundamentos', 'datos', 'tipos']);
    expect(filterTree(tree, NO_FILTERS)).toHaveLength(3);
  });

  it('finds the path and the folders above a node', () => {
    const tree = buildTree(NODES);
    expect(pathTo(tree, 'tipos').map((item) => item.displayName)).toEqual(['Fundamentos', 'Los datos', 'Tipos de datos']);
    expect(ancestorsOf(tree, 'tipos')).toEqual(['fundamentos', 'datos']);
    expect(pathTo(tree, 'nope')).toEqual([]);
  });

  it('shows a node whose parent is missing at the root', () => {
    expect(buildTree([node('suelta', 'no-existe', 'class', 'Suelta', 1)]).map((item) => item.node.id)).toEqual(['suelta']);
  });
});

describe('workspace scope', () => {
  it('keeps a stored scope that still exists and otherwise uses the first subcategory', () => {
    expect(resolveScope(CATEGORIES, { categoryId: 'cat-3', subcategoryId: 'sub-bio' })).toEqual({ categoryId: 'cat-3', subcategoryId: 'sub-bio' });
    expect(resolveScope(CATEGORIES, { categoryId: 'cat-3', subcategoryId: 'gone' })).toEqual({ categoryId: 'cat-1', subcategoryId: 'sub-ai' });
    expect(resolveScope(CATEGORIES, null)).toEqual({ categoryId: 'cat-1', subcategoryId: 'sub-ai' });
    expect(resolveScope([], null)).toBeNull();
    expect(findSubcategory(CATEGORIES, { categoryId: 'cat-1', subcategoryId: 'sub-ai' })?.displayName).toBe('Inteligencia artificial');
  });

  it('builds the badge of a category from its name', () => {
    expect(badgeOf('Academia Lumia')).toBe('AL');
    expect(badgeOf('Ciencias')).toBe('CI');
    expect(badgeOf('')).toBe('');
  });

  it('reads the stored scope and tabs defensively', () => {
    const storage = (value: string | null): Storage =>
      ({ getItem: () => value, setItem: () => undefined, removeItem: () => undefined, clear: () => undefined, key: () => null, length: 0 }) satisfies Storage;
    expect(readScope(storage('{"categoryId":"c","subcategoryId":"s"}'))).toEqual({ categoryId: 'c', subcategoryId: 's' });
    expect(readScope(storage('{"categoryId":"c"}'))).toBeNull();
    expect(readScope(storage('not json'))).toBeNull();
    expect(readTabs(storage('{"open":["a",1,"b"],"active":"b"}'))).toEqual({ open: ['a', 'b'], active: 'b' });
    expect(readTabs(storage(null))).toEqual({ open: [], active: null });
  });

  it('accepts the statuses of the filter tool only', () => {
    expect(parseStatusFilter('draft')).toBe('draft');
    expect(parseStatusFilter('none')).toBeUndefined();
  });
});
