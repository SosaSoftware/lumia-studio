<script setup lang="ts">
import { computed } from 'vue';
import { list, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { splitLabel } from './render-helpers.ts';

const props = defineProps<CatalogComponentProps>();
const items = computed(() => list(props.data.items).map((item) => splitLabel(str(item))));
const ordered = computed(() => props.data.ordered === true);
</script>

<template>
  <component :is="ordered ? 'ol' : 'ul'" class="el-list">
    <li v-for="(item, index) in items" :key="index" class="item">
      <span v-if="ordered" class="number" aria-hidden="true">{{ index + 1 }}</span>
      <span v-else class="bullet" aria-hidden="true"><span class="dot"></span></span>
      <span class="text"><b v-if="item.label">{{ item.label }}</b>{{ item.label ? ' ' : '' }}{{ item.rest }}</span>
    </li>
  </component>
</template>

<style scoped>
.el-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1.1cqw; }
.item { display: flex; align-items: center; gap: 1.6cqw; padding: 1.1cqw 1.6cqw; background: var(--sl-card); border: 0.12cqw solid var(--sl-line); border-radius: 1.2cqw; }
.number { width: 3.2cqw; height: 3.2cqw; flex: none; border-radius: 50%; background: var(--sl-blue); color: var(--sl-white); display: flex; align-items: center; justify-content: center; font-size: 1.5cqw; font-weight: 600; }
.bullet { width: 3.2cqw; height: 3.2cqw; flex: none; display: flex; align-items: center; justify-content: center; }
.dot { width: 1cqw; height: 1cqw; border-radius: 50%; background: var(--sl-blue); }
.text { font-size: 1.9cqw; line-height: 1.35; color: var(--sl-ink); overflow-wrap: anywhere; }
.text b { font-weight: 600; }
</style>
