<script setup lang="ts">
import type { TreeNode } from '../../api/types.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import StudioIcon from '../../ui/StudioIcon.vue';

const workspace = useWorkspace();

/** Folder that holds the class, shown muted next to its name. */
function folderOf(node: TreeNode): string {
  const path = workspace.pathOf(node.id);
  return path.length > 1 ? (path[path.length - 2]?.displayName ?? '') : '';
}

function title(node: TreeNode): string {
  const route = workspace.pathOf(node.id).map((item) => item.displayName).join(' › ');
  return node.description === '' ? route : `${route} · ${node.description}`;
}

function onKeydown(event: KeyboardEvent, nodeId: string): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    void workspace.activate(nodeId);
  }
}
</script>

<template>
  <div role="tablist" aria-label="Clases abiertas" class="tabs" data-testid="class-tabs">
    <div
      v-for="node in workspace.openClasses.value"
      :key="node.id"
      class="tab"
      role="tab"
      tabindex="0"
      :aria-selected="workspace.activeId.value === node.id"
      :title="title(node)"
      :data-testid="`tab-${node.id}`"
      :style="
        workspace.activeId.value === node.id
          ? { background: 'var(--s-editor)', color: 'var(--s-text)', boxShadow: 'inset 0 2px 0 var(--s-active)' }
          : { background: 'transparent', color: 'var(--s-text-2)', boxShadow: 'inset 0 -1px 0 var(--s-border)' }
      "
      @click="workspace.activate(node.id)"
      @keydown="onKeydown($event, node.id)"
    >
      <span class="ico"><StudioIcon name="class" :size="14" /></span>
      <span class="name">{{ node.displayName }}</span>
      <span v-if="folderOf(node)" class="sub">{{ folderOf(node) }}</span>
      <span v-if="node.documentStatus === 'draft'" class="draft" role="img" aria-label="Borrador sin publicar" title="Borrador sin publicar"></span>
      <button type="button" class="x" :aria-label="`Cerrar ${node.displayName}`" title="Cerrar" :data-testid="`tab-close-${node.id}`" @click.stop="workspace.closeTab(node.id)">
        <StudioIcon name="close" :size="12" :stroke="2" />
      </button>
    </div>
    <div class="fill" role="presentation"></div>
  </div>
</template>

<style scoped>
.tabs { flex: none; height: 36px; display: flex; overflow-x: auto; background: var(--s-chrome); }
.ico { display: flex; color: var(--s-ico-class); }
.sub { font-size: 12px; color: var(--s-text-2); }
.draft { width: 7px; height: 7px; border-radius: 50%; background: var(--s-warn); }
.fill { flex: 1 0 auto; box-shadow: inset 0 -1px 0 var(--s-border); }
</style>
