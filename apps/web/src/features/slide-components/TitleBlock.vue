<script setup lang="ts">
import { computed } from 'vue';
import { str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';

const props = defineProps<CatalogComponentProps>();
const level = computed(() => (str(props.data.level, 'h2') === 'h1' ? 1 : 2));
const align = computed(() => str(props.data.align, 'left'));
</script>

<template>
  <div class="el-title" role="heading" :aria-level="level" :data-level="level" :style="{ textAlign: align === 'center' || align === 'right' ? align : 'left' }">{{ str(data.text) }}</div>
</template>

<style scoped>
.el-title { margin: 0; font-size: 3.4cqw; font-weight: 600; line-height: 1.15; color: var(--sl-fg); overflow-wrap: anywhere; }
.el-title[data-level='1'] { font-size: 4.3cqw; }
</style>
