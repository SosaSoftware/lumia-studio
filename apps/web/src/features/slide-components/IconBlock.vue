<script setup lang="ts">
import { computed } from 'vue';
import { str } from '../../api/decode.ts';
import { CONTENT_ICON_LABELS, contentIcon } from './content-icons.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { toneVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const name = computed(() => str(props.data.name, 'idea'));
const label = computed(() => str(props.data.label).trim() || (Object.entries(CONTENT_ICON_LABELS).find(([key]) => key === name.value)?.[1] ?? name.value));
</script>

<template>
  <div class="el-icon">
    <span class="circle" role="img" :aria-label="label" :data-background="str(data.background, 'soft')" :data-shape="str(data.shape, 'circle')" :style="toneVars(data.color, 'accent')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path v-for="(d, index) in contentIcon(name)" :key="index" :d="d" />
      </svg>
    </span>
  </div>
</template>

<style scoped>
.el-icon { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.circle { height: 100%; max-width: 100%; aspect-ratio: 1; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--c-soft); color: var(--c-ink); }
.circle[data-shape='rounded'] { border-radius: 24%; }
.circle[data-background='none'] { background: transparent; color: var(--c); }
.circle[data-background='none'] svg { width: 82%; height: 82%; }
.circle[data-background='solid'] { background: var(--c); color: var(--c-on); }
.circle[data-background='gradient'] { background: var(--c-grad); color: var(--c-on); box-shadow: var(--sl-elev-2); }
svg { width: 55%; height: 55%; flex: none; }
</style>
