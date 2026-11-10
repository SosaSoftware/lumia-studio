<script setup lang="ts">
import { computed } from 'vue';
import type { TreeNode } from '../../api/types.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import { t, tn } from '../../i18n/index.ts';
import StudioIcon from '../../ui/StudioIcon.vue';
import { statusLabel } from '../workspace/class-status.ts';

/** Read-only properties of a folder or class of the tree; the tree is managed in the database. */
const props = defineProps<{ node: TreeNode }>();

const workspace = useWorkspace();
const isClass = computed(() => props.node.kind === 'class');
const route = computed(() => workspace.pathOf(props.node.id).slice(0, -1).map((item) => item.displayName));
const status = computed(() => {
  if (!isClass.value) return '';
  const label = statusLabel(props.node.documentStatus ?? 'no_content');
  return props.node.currentVersion === null ? label : t('properties.node.statusVersion', { label, number: props.node.currentVersion });
});
const kindLabel = computed(() => (isClass.value ? t('properties.node.class') : t('properties.node.folder')));
const contents = computed(() => {
  if (isClass.value) return '';
  const children = workspace.nodes.value.filter((node) => node.parentId === props.node.id);
  const folders = children.filter((node) => node.kind === 'folder').length;
  const classes = children.length - folders;
  const parts: string[] = [];
  if (folders > 0) parts.push(tn('properties.node.folders', folders));
  if (classes > 0) parts.push(tn('properties.node.classes', classes));
  return parts.length === 0 ? t('properties.node.empty') : parts.join(' · ');
});
</script>

<template>
  <div class="prop-body" data-testid="node-properties">
    <div class="s-identity" :aria-label="t('properties.node.nodeLabel', { kind: kindLabel, name: node.displayName })">
      <span class="kind" aria-hidden="true"><StudioIcon :name="isClass ? 'class' : 'folder'" :size="16" /></span>
      <span class="s-identity-meta">
        <span class="s-identity-where">{{ route.length > 0 ? route.join(' › ') : (workspace.subcategory.value?.displayName ?? '') }}</span>
        <span class="s-identity-title" data-testid="node-display-name">{{ node.displayName }}</span>
      </span>
      <span class="s-identity-pill">{{ kindLabel }}</span>
    </div>

    <section class="prop-sec">
      <h3 class="lbl">{{ t('properties.node.general') }}</h3>
      <div class="prop-field">
        <span class="prop-label">{{ t('common.name') }}</span>
        <code class="value mono" data-testid="node-name">{{ node.name }}</code>
      </div>
      <div class="prop-field">
        <span class="prop-label">{{ t('properties.node.description') }}</span>
        <p class="value" :class="{ muted: node.description === '' }" data-testid="node-description">{{ node.description === '' ? t('properties.node.noDescription') : node.description }}</p>
      </div>
      <div v-if="isClass" class="prop-field">
        <span class="prop-label">{{ t('properties.node.content') }}</span>
        <p class="value" data-testid="node-status">{{ status }}</p>
      </div>
      <div v-else class="prop-field">
        <span class="prop-label">{{ t('properties.node.contains') }}</span>
        <p class="value" data-testid="node-contents">{{ contents }}</p>
      </div>
    </section>
    <p v-if="isClass" class="prop-hint hint">{{ t('properties.node.openHint') }}</p>
  </div>
</template>

<style scoped>
.kind { width: 28px; height: 28px; flex: none; display: flex; align-items: center; justify-content: center; border-radius: 7px; background: var(--s-hover); color: var(--s-ico-class); }
.value { margin: 0; font-size: 13px; line-height: 1.5; color: var(--s-text); overflow-wrap: anywhere; white-space: pre-line; }
.value.muted { color: var(--s-text-2); }
.mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 12px; }
.hint { margin: 0 14px; }
</style>
