<script setup lang="ts">
import { computed } from 'vue';
import type { SlideElement } from '../../api/types.ts';
import { componentFor } from './index.ts';
import type { ElementMode } from './element-mode.ts';

const props = withDefaults(defineProps<{ element: SlideElement; mode: ElementMode; selected?: boolean }>(), { selected: false });
const view = computed(() => componentFor(props.element.component));
</script>

<template>
  <component :is="view" v-if="view" :data="element.props" :mode="mode" :media="element.media" :element-id="element.id" :selected="selected" />
  <div v-else class="el-unknown">Componente desconocido: {{ element.component }}</div>
</template>

<style scoped>
.el-unknown { width: 100%; height: 100%; box-sizing: border-box; display: flex; align-items: center; justify-content: center; padding: 1cqw; border: 0.2cqw dashed var(--sl-red-ink); border-radius: 1cqw; color: var(--sl-red-ink); font-size: 1.4cqw; text-align: center; }
</style>
