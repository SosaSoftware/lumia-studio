import type { DocumentStatus, TreeNode } from '../../api/types.ts';
import { compareText } from '../../i18n/index.ts';

/** Filters of the tree. People do not see filter controls; Lumi's `filter_tree` sets them and the panel shows them. */
export interface TreeFilters {
  status: 'all' | DocumentStatus;
  text: string;
}

/** A node of the tree with its children, siblings ordered by position and then by display name. */
export interface TreeItem {
  node: TreeNode;
  children: TreeItem[];
}

export interface TreeRow {
  item: TreeItem;
  level: number;
  expanded: boolean;
  parentId: string | null;
}

export const NO_FILTERS: TreeFilters = { status: 'all', text: '' };

export function isFiltering(filters: TreeFilters): boolean {
  return filters.status !== 'all' || filters.text.trim() !== '';
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function bySiblingOrder(a: TreeItem, b: TreeItem): number {
  return a.node.position - b.node.position || compareText(a.node.displayName, b.node.displayName) || a.node.name.localeCompare(b.node.name);
}

/** Builds the tree from the flat list the API returns; a node whose parent is missing is shown at the root. */
export function buildTree(nodes: readonly TreeNode[]): TreeItem[] {
  const items = new Map(nodes.map((node) => [node.id, { node, children: [] as TreeItem[] }]));
  const roots: TreeItem[] = [];
  for (const item of items.values()) {
    const parent = item.node.parentId === null ? undefined : items.get(item.node.parentId);
    (parent?.children ?? roots).push(item);
  }
  const sort = (list: TreeItem[]): void => {
    list.sort(bySiblingOrder);
    for (const item of list) sort(item.children);
  };
  sort(roots);
  return roots;
}

/**
 * Keeps the classes that match the filters and the folders on their way. A folder whose name matches the text keeps
 * all of its content.
 */
export function filterTree(items: readonly TreeItem[], filters: TreeFilters): TreeItem[] {
  if (!isFiltering(filters)) return [...items];
  const needle = normalize(filters.text.trim());
  const matchesText = (node: TreeNode): boolean => needle === '' || normalize(`${node.displayName} ${node.name} ${node.description}`).includes(needle);
  const visit = (item: TreeItem, keepAll: boolean): TreeItem | null => {
    const { node } = item;
    if (node.kind === 'class') {
      const statusOk = filters.status === 'all' || node.documentStatus === filters.status;
      return statusOk && (keepAll || matchesText(node)) ? item : null;
    }
    const folderMatches = keepAll || (needle !== '' && matchesText(node));
    const children = item.children.flatMap((child) => {
      const kept = visit(child, folderMatches);
      return kept === null ? [] : [kept];
    });
    return children.length > 0 ? { node, children } : null;
  };
  return items.flatMap((item) => {
    const kept = visit(item, false);
    return kept === null ? [] : [kept];
  });
}

/** Visible rows for the expanded folders; `expandAll` shows every level (used while filtering). */
export function flattenTree(items: readonly TreeItem[], expanded: ReadonlySet<string>, expandAll = false, level = 1, parentId: string | null = null): TreeRow[] {
  return items.flatMap((item) => {
    const open = item.children.length > 0 && (expandAll || expanded.has(item.node.id));
    const row: TreeRow = { item, level, expanded: open, parentId };
    return open ? [row, ...flattenTree(item.children, expanded, expandAll, level + 1, item.node.id)] : [row];
  });
}

/** Opens the first folder of each level down to the first class, so the tree shows content on arrival. */
export function defaultExpanded(items: readonly TreeItem[]): Set<string> {
  const ids = new Set<string>();
  let level: readonly TreeItem[] = items;
  for (;;) {
    const first = level.find((item) => item.node.kind === 'folder' && item.children.length > 0);
    if (first === undefined) break;
    ids.add(first.node.id);
    if (first.children.some((child) => child.node.kind === 'class')) break;
    level = first.children;
  }
  return ids;
}

/** Nodes from the root down to the node itself; empty when the id is not in the tree. */
export function pathTo(items: readonly TreeItem[], id: string): TreeNode[] {
  for (const item of items) {
    if (item.node.id === id) return [item.node];
    const below = pathTo(item.children, id);
    if (below.length > 0) return [item.node, ...below];
  }
  return [];
}

/** Ids of the folders that contain the node. */
export function ancestorsOf(items: readonly TreeItem[], id: string): string[] {
  return pathTo(items, id).slice(0, -1).map((node) => node.id);
}

export function countClasses(item: TreeItem): number {
  return item.node.kind === 'class' ? 1 : item.children.reduce((sum, child) => sum + countClasses(child), 0);
}
