import { computed, reactive, ref, watch } from 'vue';
import { ApiError } from '../../api/graphql-client.ts';
import type { StudioApi } from '../../api/studio-api.ts';
import type { Category, DocumentStatus, TreeNode } from '../../api/types.ts';
import { isPaletteGroup, panels } from '../../composables/panels.ts';
import { t } from '../../i18n/index.ts';
import { CatalogStore } from '../editor/catalog-store.ts';
import { DocumentSession } from '../editor/document-session.ts';
import { MediaStore } from '../media/media-store.ts';
import { VoiceStore } from '../timeline/voice-store.ts';
import { NO_FILTERS, ancestorsOf, buildTree, defaultExpanded, filterTree, isFiltering, pathTo } from '../tree/tree-model.ts';
import type { TreeFilters, TreeItem } from '../tree/tree-model.ts';
import { findSubcategory, resolveScope } from './scope-model.ts';
import type { WorkspaceScope } from './scope-model.ts';

export const TABS_KEY = 'lumia.studio.tabs';
export const SCOPE_KEY = 'lumia.studio.scope';

interface StoredTabs {
  open: string[];
  active: string | null;
}

function parseStored(storage: Storage, key: string): Record<string, unknown> | null {
  try {
    const raw = storage.getItem(key);
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? { ...parsed } : null;
  } catch {
    // A corrupted stored value is treated as missing.
    return null;
  }
}

/** Reads the open tabs; ids that are not strings are dropped. */
export function readTabs(storage: Storage = localStorage): StoredTabs {
  const value = parseStored(storage, TABS_KEY);
  if (value === null) return { open: [], active: null };
  const open = Array.isArray(value.open) ? value.open.filter((id): id is string => typeof id === 'string') : [];
  return { open, active: typeof value.active === 'string' ? value.active : null };
}

export function readScope(storage: Storage = localStorage): WorkspaceScope | null {
  const value = parseStored(storage, SCOPE_KEY);
  return value !== null && typeof value.categoryId === 'string' && typeof value.subcategoryId === 'string'
    ? { categoryId: value.categoryId, subcategoryId: value.subcategoryId }
    : null;
}

/** Statuses that Lumi's `filter_tree` accepts. */
export function parseStatusFilter(value: unknown): TreeFilters['status'] | undefined {
  const statuses: readonly TreeFilters['status'][] = ['all', 'no_content', 'draft', 'published'];
  return statuses.find((status) => status === value);
}

/**
 * State of the workspace: the categories of the person, the category and subcategory whose tree is shown, the tree
 * state, the open tabs and the class being edited. As in the design, the tabs belong to the selected subcategory.
 */
export class WorkspaceStore {
  public readonly categories = ref<Category[]>([]);
  /** Folders and classes of the selected subcategory. */
  public readonly nodes = ref<TreeNode[]>([]);
  public readonly loading = ref(false);
  public readonly loaded = ref(false);
  public readonly error = ref<string | null>(null);
  public readonly scope = ref<WorkspaceScope | null>(null);
  public readonly openIds = ref<string[]>([]);
  public readonly activeId = ref<string | null>(null);
  public readonly filters = reactive<TreeFilters>({ ...NO_FILTERS });
  public readonly expanded = ref(new Set<string>());
  public readonly treeRootOpen = ref(true);
  public readonly selectedId = ref<string | null>(null);
  /** Tree node shown in Properties; editing a slide, element or clip shows those instead. */
  public readonly inspectedId = ref<string | null>(null);
  public readonly previewOpen = ref(false);
  public readonly catalog = new CatalogStore();
  public readonly media: MediaStore;
  public readonly voices: VoiceStore;
  public readonly session: DocumentSession;

  public readonly category = computed(() => this.categories.value.find((category) => category.id === this.scope.value?.categoryId) ?? null);
  public readonly subcategory = computed(() => findSubcategory(this.categories.value, this.scope.value));
  public readonly fullTree = computed<TreeItem[]>(() => buildTree(this.nodes.value));
  public readonly tree = computed<TreeItem[]>(() => filterTree(this.fullTree.value, this.filters));
  public readonly filtering = computed(() => isFiltering(this.filters));
  public readonly classes = computed(() => this.nodes.value.filter((node) => node.kind === 'class'));
  public readonly openClasses = computed(() =>
    this.openIds.value.flatMap((id) => {
      const node = this.nodeById(id);
      return node === null ? [] : [node];
    }),
  );
  public readonly activeClass = computed(() => (this.activeId.value === null ? null : this.nodeById(this.activeId.value)));
  public readonly inspectedNode = computed(() => (this.inspectedId.value === null ? null : this.nodeById(this.inspectedId.value)));
  /** Display names from the root of the tree to the selected node, for the status bar when no class is open. */
  public readonly selectedPath = computed(() => (this.selectedId.value === null ? [] : this.pathOf(this.selectedId.value).map((node) => node.displayName)));

  public constructor(
    private readonly api: StudioApi,
    private readonly storage: Storage = localStorage,
  ) {
    this.media = new MediaStore(api);
    this.voices = new VoiceStore(api);
    this.session = new DocumentSession(api, this.catalog, () => {
      void this.refreshNodes();
    });
    // Selecting a slide, an element or a clip shows it in Properties instead of the tree node.
    watch(
      () => [this.session.state.selectedSlideId, this.session.state.selectedElementIds, this.session.state.selectedClip],
      () => {
        this.inspectedId.value = null;
      },
    );
  }

  /** Loads the catalog and the categories, then restores the scope and the tabs of the last visit. */
  public async init(): Promise<void> {
    if (this.loading.value) return;
    this.loading.value = true;
    try {
      const [, categories] = await Promise.all([this.catalog.load(this.api), this.api.categories()]);
      this.categories.value = categories;
      this.error.value = null;
    } catch (error) {
      this.error.value = WorkspaceStore.messageOf(error, t('tree.loadCategoriesFailed'));
    }
    this.scope.value = resolveScope(this.categories.value, readScope(this.storage));
    this.media.useCategory(this.scope.value?.categoryId ?? null);
    await this.refreshNodes();
    this.loading.value = false;
    this.loaded.value = true;
    this.resetTree();
    const stored = readTabs(this.storage);
    this.openIds.value = stored.open.filter((id) => this.nodeById(id)?.kind === 'class');
    const active = stored.active !== null && this.openIds.value.includes(stored.active) ? stored.active : (this.openIds.value[0] ?? null);
    if (active !== null) await this.activate(active);
    else this.persist();
  }

  /** Re-queries the tree of the subcategory, so the status of each class is current. */
  public async refreshNodes(): Promise<void> {
    const subcategoryId = this.scope.value?.subcategoryId;
    if (subcategoryId === undefined) {
      this.nodes.value = [];
      return;
    }
    try {
      this.nodes.value = await this.api.treeNodes(subcategoryId);
      this.error.value = null;
    } catch (error) {
      this.error.value = WorkspaceStore.messageOf(error, t('tree.loadTreeFailed'));
    }
  }

  public nodeById(id: string): TreeNode | null {
    return this.nodes.value.find((node) => node.id === id) ?? null;
  }

  /** Nodes from the root of the subcategory down to the node. */
  public pathOf(id: string): TreeNode[] {
    return pathTo(this.fullTree.value, id);
  }

  /** Shows the tree of another category or subcategory; the open tabs close, as in the design. */
  public async selectScope(categoryId: string, subcategoryId?: string): Promise<void> {
    const category = this.categories.value.find((candidate) => candidate.id === categoryId);
    const subcategory = category?.subcategories.find((candidate) => candidate.id === subcategoryId) ?? category?.subcategories[0];
    if (category === undefined || subcategory === undefined) return;
    if (this.scope.value?.categoryId === category.id && this.scope.value.subcategoryId === subcategory.id) return;
    await this.session.flush();
    this.openIds.value = [];
    this.activeId.value = null;
    this.inspectedId.value = null;
    await this.session.close();
    this.scope.value = { categoryId: category.id, subcategoryId: subcategory.id };
    this.media.useCategory(category.id);
    Object.assign(this.filters, NO_FILTERS);
    this.nodes.value = [];
    await this.refreshNodes();
    this.resetTree();
    if (isPaletteGroup(panels.left)) panels.left = 'explorer';
    this.persist();
  }

  private resetTree(): void {
    this.expanded.value = defaultExpanded(this.fullTree.value);
    this.treeRootOpen.value = true;
    this.selectedId.value = null;
  }

  public toggleNode(id: string): void {
    const next = new Set(this.expanded.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.expanded.value = next;
  }

  public collapseAll(): void {
    this.expanded.value = new Set();
    this.treeRootOpen.value = true;
  }

  /** Shows the properties of the current slide: nothing inside it and no node of the tree is selected. */
  public showSlide(): void {
    this.inspectedId.value = null;
    this.session.selectElement(null);
    this.session.selectClip(null);
  }

  /** Selects a node, opens the folders that contain it and shows it in Properties. */
  public select(id: string): void {
    this.reveal(id);
    this.inspectedId.value = id;
  }

  /** Opens the folders that contain the node so it is visible, and marks it as selected. */
  public reveal(id: string): void {
    const next = new Set(this.expanded.value);
    for (const ancestor of ancestorsOf(this.fullTree.value, id)) next.add(ancestor);
    this.expanded.value = next;
    this.treeRootOpen.value = true;
    this.selectedId.value = id;
  }

  /** Opens a class of the shown subcategory in a tab and makes it the active one. */
  public async openClass(nodeId: string): Promise<boolean> {
    if (this.nodeById(nodeId)?.kind !== 'class') return false;
    if (!this.openIds.value.includes(nodeId)) this.openIds.value = [...this.openIds.value, nodeId];
    await this.activate(nodeId);
    return true;
  }

  public async activate(nodeId: string): Promise<void> {
    this.reveal(nodeId);
    this.inspectedId.value = null;
    if (this.activeId.value === nodeId && this.session.state.classNode?.id === nodeId) return;
    this.activeId.value = nodeId;
    this.persist();
    const node = this.nodeById(nodeId);
    if (node !== null) await this.session.open(node);
  }

  public async closeTab(nodeId: string): Promise<void> {
    const index = this.openIds.value.indexOf(nodeId);
    if (index < 0) return;
    this.openIds.value = this.openIds.value.filter((id) => id !== nodeId);
    if (this.activeId.value !== nodeId) {
      this.persist();
      return;
    }
    const next = this.openIds.value[Math.min(index, this.openIds.value.length - 1)] ?? null;
    if (next === null) {
      this.activeId.value = null;
      this.persist();
      await this.session.close();
      // Without an open class the component groups cannot be used, so the explorer comes back.
      if (isPaletteGroup(panels.left)) panels.left = 'explorer';
    } else {
      this.activeId.value = null;
      await this.activate(next);
    }
  }

  /** Sets the filters of Lumi's `filter_tree` tool. */
  public setFilters(next: { status?: TreeFilters['status']; text?: string }): void {
    if (next.status !== undefined) this.filters.status = next.status;
    if (next.text !== undefined) this.filters.text = next.text;
    this.treeRootOpen.value = true;
  }

  public clearFilters(): void {
    Object.assign(this.filters, NO_FILTERS);
  }

  /** Number of classes of the subcategory by status, for Lumi's context. */
  public countByStatus(): Record<DocumentStatus, number> {
    const counts: Record<DocumentStatus, number> = { no_content: 0, draft: 0, published: 0 };
    for (const node of this.classes.value) counts[node.documentStatus ?? 'no_content'] += 1;
    return counts;
  }

  private persist(): void {
    try {
      this.storage.setItem(TABS_KEY, JSON.stringify({ open: this.openIds.value, active: this.activeId.value }));
      if (this.scope.value !== null) this.storage.setItem(SCOPE_KEY, JSON.stringify(this.scope.value));
    } catch {
      // Not remembering the tabs is harmless.
    }
  }

  private static messageOf(error: unknown, fallback: string): string {
    return error instanceof ApiError ? error.message : fallback;
  }
}
