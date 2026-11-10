import type { Category, Subcategory } from '../../api/types.ts';
import { upperCase } from '../../i18n/index.ts';

/** Category and subcategory whose tree the workspace shows. */
export interface WorkspaceScope {
  categoryId: string;
  subcategoryId: string;
}

/** The stored scope when it still exists; otherwise the first subcategory of the first category that has one. */
export function resolveScope(categories: readonly Category[], stored: WorkspaceScope | null): WorkspaceScope | null {
  if (stored !== null) {
    const category = categories.find((candidate) => candidate.id === stored.categoryId);
    if (category?.subcategories.some((subcategory) => subcategory.id === stored.subcategoryId) === true) return stored;
  }
  for (const category of categories) {
    const first = category.subcategories[0];
    if (first !== undefined) return { categoryId: category.id, subcategoryId: first.id };
  }
  return null;
}

export function findSubcategory(categories: readonly Category[], scope: WorkspaceScope | null): Subcategory | null {
  if (scope === null) return null;
  return categories.find((category) => category.id === scope.categoryId)?.subcategories.find((subcategory) => subcategory.id === scope.subcategoryId) ?? null;
}

/** Up to two letters for the badge of a category, e.g. "Academia Lumia" becomes "AL". */
export function badgeOf(displayName: string): string {
  const words = displayName.split(/\s+/).filter((word) => /\p{L}|\p{N}/u.test(word));
  const [first, second] = words;
  if (first === undefined) return '';
  return upperCase(second === undefined ? first.slice(0, 2) : `${first.charAt(0)}${second.charAt(0)}`);
}

/** Items of a menu under their visual group; `name` is null for the items without a group. */
export interface MenuGroup<T> {
  readonly name: string | null;
  readonly items: readonly T[];
}

/**
 * Groups menu items by `groupName`, keeping their order: items without a group come first, without a heading,
 * and each group appears where its first item is. Groups only organize the menu; they cannot be selected.
 */
export function groupByName<T extends { readonly groupName: string | null }>(items: readonly T[]): MenuGroup<T>[] {
  const ungrouped: T[] = [];
  const groups = new Map<string, T[]>();
  for (const item of items) {
    if (item.groupName === null) {
      ungrouped.push(item);
    } else {
      const members = groups.get(item.groupName) ?? [];
      members.push(item);
      groups.set(item.groupName, members);
    }
  }
  const named = [...groups].map(([name, members]): MenuGroup<T> => ({ name, items: members }));
  return ungrouped.length === 0 ? named : [{ name: null, items: ungrouped }, ...named];
}
