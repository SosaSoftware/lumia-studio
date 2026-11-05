<script setup lang="ts">
import { computed } from 'vue';
import { THEME_COLOR_KEYS } from '@lumia/packages/catalog';
import { str } from '../../api/decode.ts';
import { CONTENT_ICON_LABELS, contentIcon } from './content-icons.ts';
import type { CatalogComponentProps } from './element-mode.ts';

const props = defineProps<CatalogComponentProps>();
const name = computed(() => str(props.data.name, 'idea'));
const color = computed(() => THEME_COLOR_KEYS.find((key) => key === props.data.color) ?? 'accent');
const label = computed(() => str(props.data.label).trim() || (Object.entries(CONTENT_ICON_LABELS).find(([key]) => key === name.value)?.[1] ?? name.value));
</script>

<template>
  <div class="el-icon">
    <span class="circle" role="img" :aria-label="label" :style="{ background: `var(--sl-${color}-soft)`, color: `var(--sl-${color}-ink)` }">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path v-for="(d, index) in contentIcon(name)" :key="index" :d="d" />
      </svg>
    </span>
  </div>
</template>

<style scoped>
.el-icon { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.circle { height: 100%; max-width: 100%; aspect-ratio: 1; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
svg { width: 55%; height: 55%; flex: none; }
</style>
