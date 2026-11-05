<script setup lang="ts">
import { computed } from 'vue';
import { THEME_COLOR_KEYS } from '@lumia/packages/catalog';
import { num, str } from '../../api/decode.ts';
import ArrowGlyph from './ArrowGlyph.vue';
import type { CatalogComponentProps } from './element-mode.ts';

const props = defineProps<CatalogComponentProps>();
const kind = computed(() => str(props.data.kind, 'rectangle'));
const fill = computed(() => THEME_COLOR_KEYS.find((key) => key === props.data.fill) ?? 'surface-alt');
const stroke = computed(() => THEME_COLOR_KEYS.find((key) => key === props.data.stroke) ?? 'accent');
const weight = computed(() => num(props.data.strokeWidth, 1));
const KINDS: Record<string, string> = { rectangle: 'Rectángulo', ellipse: 'Elipse', line: 'Línea', arrow: 'Flecha' };
</script>

<template>
  <div class="el-shape" role="img" :aria-label="KINDS[kind] ?? 'Forma'">
    <div
      v-if="kind === 'rectangle' || kind === 'ellipse'"
      class="box"
      :style="{
        borderRadius: kind === 'ellipse' ? '50%' : '1.2cqw',
        background: `var(--sl-${fill}-soft)`,
        border: weight > 0 ? `calc(${weight} * 0.12cqw) solid var(--sl-${stroke})` : '0',
      }"
    ></div>
    <div v-else-if="kind === 'line'" class="line-wrap"><span class="line" :style="{ height: `max(0.2cqw, ${weight * 0.15}cqw)`, background: `var(--sl-${stroke})` }"></span></div>
    <ArrowGlyph v-else :color="`var(--sl-${stroke})`" :weight="Math.max(1, weight)" />
  </div>
</template>

<style scoped>
.el-shape { width: 100%; height: 100%; }
.box { width: 100%; height: 100%; box-sizing: border-box; }
.line-wrap { width: 100%; height: 100%; display: flex; align-items: center; }
.line { flex: 1; border-radius: 0.3cqw; }
</style>
