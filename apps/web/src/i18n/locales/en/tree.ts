import type { tree as esTree } from '../es/tree.ts';

export const tree: typeof esTree = {
  title: 'Explorer',
  collapseAll: 'Collapse all',
  hide: 'Hide the explorer',
  hideShort: 'Hide',
  filtered: 'Filtered: {summary}',
  clear: 'Clear',
  contentOf: 'Contents of {name}',
  loading: 'Loading the content…',
  noAccess: 'You do not have access to any category yet.',
  noClasses: 'This subcategory has no classes yet.',
  noMatches: 'No classes match the filter.',
  loadCategoriesFailed: 'The categories could not be loaded.',
  loadTreeFailed: 'The tree could not be loaded.',
};
