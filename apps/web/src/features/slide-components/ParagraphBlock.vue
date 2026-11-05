<script setup lang="ts">
import { computed } from 'vue';
import { str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';

const props = defineProps<CatalogComponentProps>();
const size = computed(() => str(props.data.size, 'md'));
const align = computed(() => str(props.data.align, 'left'));
</script>

<template>
  <p class="el-paragraph" :data-size="size" :style="{ textAlign: align === 'center' || align === 'right' ? align : 'left' }">{{ str(data.text) }}</p>
</template>

<style scoped>
.el-paragraph { margin: 0; font-size: 1.8cqw; font-weight: 400; line-height: 1.45; color: var(--sl-fg-2); white-space: pre-line; overflow-wrap: anywhere; }
.el-paragraph[data-size='sm'] { font-size: 1.45cqw; }
.el-paragraph[data-size='lg'] { font-size: 2.2cqw; }
</style>
