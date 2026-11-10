<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import type { DocumentStatus } from '../../api/types.ts';
import { panels } from '../../composables/panels.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import { t } from '../../i18n/index.ts';
import StudioIcon from '../../ui/StudioIcon.vue';
import { statusLabel as documentStatusLabel } from '../workspace/class-status.ts';
import { flattenTree } from './tree-model.ts';
import type { TreeRow } from './tree-model.ts';

const workspace = useWorkspace();
const treeEl = ref<HTMLElement | null>(null);
const focusId = ref<string | null>(null);

const rootName = computed(() => workspace.subcategory.value?.displayName ?? t('tree.title'));
const rows = computed<TreeRow[]>(() => (workspace.treeRootOpen.value ? flattenTree(workspace.tree.value, workspace.expanded.value, workspace.filtering.value) : []));
const tabId = computed(() => {
  const ids = rows.value.map((row) => row.item.node.id);
  for (const id of [focusId.value, workspace.selectedId.value]) if (id !== null && ids.includes(id)) return id;
  return ids[0] ?? null;
});
const filterSummary = computed(() => {
  const parts: string[] = [];
  if (workspace.filters.status !== 'all') parts.push(documentStatusLabel(workspace.filters.status));
  if (workspace.filters.text.trim() !== '') parts.push(`“${workspace.filters.text.trim()}”`);
  return parts.join(' · ');
});

const DOT: Record<DocumentStatus, string> = { no_content: 'var(--s-border)', draft: 'var(--s-warn)', published: 'var(--s-ok)' };

function guides(level: number, selected: boolean): string {
  const layers: string[] = [];
  for (let index = 1; index < level; index += 1) layers.push(`linear-gradient(var(--s-guide), var(--s-guide)) no-repeat ${String(12 + (index - 1) * 16 + 7)}px 0 / 1px 100%`);
  layers.push(selected ? 'var(--s-sel)' : 'transparent');
  return layers.join(', ');
}

function iconOf(row: TreeRow): string {
  if (row.item.node.kind === 'class') return 'class';
  return row.expanded ? 'folder-open' : 'folder';
}

function statusLabel(row: TreeRow): string {
  const { node } = row.item;
  const label = documentStatusLabel(node.documentStatus ?? 'no_content');
  return node.currentVersion === null ? label : `${label} · v${String(node.currentVersion)}`;
}

function click(row: TreeRow): void {
  focusId.value = row.item.node.id;
  workspace.select(row.item.node.id);
  if (row.item.children.length > 0) workspace.toggleNode(row.item.node.id);
}

function open(row: TreeRow): void {
  if (row.item.node.kind === 'class') void workspace.openClass(row.item.node.id);
}

async function focusRow(id: string): Promise<void> {
  focusId.value = id;
  await nextTick();
  treeEl.value?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`)?.focus();
}

function onKeydown(event: KeyboardEvent, row: TreeRow, index: number): void {
  const list = rows.value;
  const { node } = row.item;
  const move = (target: TreeRow | undefined): void => {
    if (target === undefined) return;
    event.preventDefault();
    void focusRow(target.item.node.id);
  };
  switch (event.key) {
    case 'ArrowDown':
      move(list[index + 1]);
      break;
    case 'ArrowUp':
      move(list[index - 1]);
      break;
    case 'Home':
      move(list[0]);
      break;
    case 'End':
      move(list[list.length - 1]);
      break;
    case 'ArrowRight':
      event.preventDefault();
      if (row.item.children.length > 0 && !row.expanded) workspace.toggleNode(node.id);
      else if (row.expanded) move(list[index + 1]);
      break;
    case 'ArrowLeft':
      event.preventDefault();
      if (row.expanded) workspace.toggleNode(node.id);
      else if (row.parentId !== null) void focusRow(row.parentId);
      break;
    case 'Enter':
      event.preventDefault();
      if (node.kind === 'class') open(row);
      else click(row);
      break;
    case ' ':
      event.preventDefault();
      click(row);
      break;
    default:
  }
}
</script>

<template>
  <section class="panel" aria-labelledby="h-explorer" data-testid="panel-explorer">
    <div class="s-panel-head">
      <h2 id="h-explorer" class="lbl">{{ t('tree.title') }}</h2>
      <div class="tools">
        <button type="button" class="ib" :aria-label="t('tree.collapseAll')" :title="t('tree.collapseAll')" data-testid="tree-collapse" @click="workspace.collapseAll()">
          <StudioIcon name="collapse-all" :size="15" />
        </button>
        <button type="button" class="ib" :aria-label="t('tree.hide')" :title="t('tree.hideShort')" @click="panels.left = null">
          <StudioIcon name="minus" :size="15" />
        </button>
      </div>
    </div>
    <button type="button" class="sec" :aria-expanded="workspace.treeRootOpen.value" data-testid="tree-root" @click="workspace.treeRootOpen.value = !workspace.treeRootOpen.value">
      <span aria-hidden="true" class="root-chev" :style="{ transform: `rotate(${workspace.treeRootOpen.value ? 90 : 0}deg)` }"><StudioIcon name="chevron-right" :size="12" :stroke="2" /></span>
      <span class="ellipsis">{{ rootName }}</span>
    </button>
    <div v-if="workspace.filtering.value" class="filtered" role="status" data-testid="tree-filtered">
      <StudioIcon name="filter" :size="13" />
      <span class="ellipsis">{{ t('tree.filtered', { summary: filterSummary }) }}</span>
      <button type="button" class="lnk" data-testid="tree-filter-clear" @click="workspace.clearFilters()">{{ t('tree.clear') }}</button>
    </div>
    <p v-if="workspace.error.value" class="msg error" role="alert">{{ workspace.error.value }}</p>
    <div ref="treeEl" role="tree" :aria-label="t('tree.contentOf', { name: rootName })" class="tree" data-testid="content-tree">
      <div
        v-for="(row, index) in rows"
        :key="row.item.node.id"
        class="row"
        role="treeitem"
        :tabindex="row.item.node.id === tabId ? 0 : -1"
        :aria-level="row.level"
        :aria-expanded="row.item.children.length > 0 ? row.expanded : undefined"
        :aria-selected="workspace.selectedId.value === row.item.node.id"
        :title="row.item.node.description === '' ? row.item.node.displayName : `${row.item.node.displayName} · ${row.item.node.description}`"
        :data-id="row.item.node.id"
        :data-testid="`tree-${row.item.node.kind}-${row.item.node.id}`"
        :data-kind="row.item.node.kind"
        :data-status="row.item.node.documentStatus ?? undefined"
        :data-active="workspace.activeId.value === row.item.node.id"
        :style="{
          paddingLeft: `${12 + (row.level - 1) * 16}px`,
          background: guides(row.level, workspace.selectedId.value === row.item.node.id),
          boxShadow: workspace.selectedId.value === row.item.node.id ? 'inset 0 0 0 1px var(--s-sel-line)' : 'none',
        }"
        @click="click(row)"
        @dblclick="open(row)"
        @keydown="onKeydown($event, row, index)"
        @focus="focusId = row.item.node.id"
      >
        <span class="chev" aria-hidden="true">
          <span v-if="row.item.children.length > 0" class="rot" :style="{ transform: `rotate(${row.expanded ? 90 : 0}deg)` }"><StudioIcon name="chevron-right" :size="12" :stroke="2" /></span>
        </span>
        <span class="ico" :class="row.item.node.kind" aria-hidden="true"><StudioIcon :name="iconOf(row)" :size="15" /></span>
        <span class="label">{{ row.item.node.displayName }}</span>
        <span v-if="row.item.node.kind === 'class'" class="state" role="img" :aria-label="statusLabel(row)" :title="statusLabel(row)">
          <span class="dot" :style="{ background: DOT[row.item.node.documentStatus ?? 'no_content'] }"></span>
        </span>
      </div>
      <p v-if="workspace.loading.value && rows.length === 0" class="msg">{{ t('tree.loading') }}</p>
      <p v-else-if="workspace.loaded.value && workspace.scope.value === null" class="msg">{{ t('tree.noAccess') }}</p>
      <p v-else-if="workspace.loaded.value && workspace.nodes.value.length === 0" class="msg">{{ t('tree.noClasses') }}</p>
      <p v-else-if="workspace.filtering.value && rows.length === 0" class="msg">{{ t('tree.noMatches') }}</p>
    </div>
  </section>
</template>

<style scoped>
.panel { flex: none; width: 320px; min-height: 0; display: flex; flex-direction: column; background: var(--s-panel); border-right: 1px solid var(--s-border); }
.tools { display: flex; gap: 2px; }
.root-chev { display: flex; }
.ellipsis { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.filtered { flex: none; margin: 2px 10px 6px; padding: 5px 8px; display: flex; align-items: center; gap: 6px; border-radius: 6px; background: var(--s-hover); color: var(--s-text-2); font-size: 12px; }
.filtered .lnk { margin-left: auto; }
.tree { flex: 1 1 auto; min-height: 0; overflow: auto; padding-bottom: 10px; }
.chev { width: 16px; flex: none; display: flex; justify-content: center; color: var(--s-text-2); }
.rot { display: flex; }
.ico { display: flex; color: var(--s-ico-folder); }
.ico.class { color: var(--s-ico-class); }
.label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.state { margin-left: auto; padding-left: 6px; flex: none; display: flex; }
.dot { width: 7px; height: 7px; border-radius: 50%; }
.msg { margin: 8px 14px; font-size: 12px; line-height: 1.5; color: var(--s-text-2); }
.msg.error { color: var(--s-danger); }
</style>
