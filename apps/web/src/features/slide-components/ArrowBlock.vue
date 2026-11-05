<script setup lang="ts">
import { computed } from 'vue';
import { THEME_COLOR_KEYS } from '@lumia/packages/catalog';
import { num, str } from '../../api/decode.ts';
import ArrowGlyph from './ArrowGlyph.vue';
import type { CatalogComponentProps } from './element-mode.ts';

const props = defineProps<CatalogComponentProps>();
const color = computed(() => `var(--sl-${THEME_COLOR_KEYS.find((key) => key === props.data.color) ?? 'accent'})`);
const DIRECTIONS: Record<string, string> = { right: 'derecha', left: 'izquierda', up: 'arriba', down: 'abajo' };
</script>

<template>
  <div class="el-arrow" role="img" :aria-label="`Flecha hacia ${DIRECTIONS[str(data.direction, 'right')] ?? 'la derecha'}`">
    <ArrowGlyph :direction="str(data.direction, 'right')" :color="color" :weight="num(data.strokeWidth, 2)" />
  </div>
</template>

<style scoped>
.el-arrow { width: 100%; height: 100%; }
</style>
