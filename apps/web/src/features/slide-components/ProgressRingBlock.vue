<script setup lang="ts">
import { computed } from 'vue';
import { num, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useCountUp, useMotion } from './motion.ts';
import { formatNumber } from './render-helpers.ts';
import { toneVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const { live } = useMotion(props);
const max = computed(() => Math.max(1, num(props.data.max, 100)));
const value = computed(() => Math.min(max.value, Math.max(0, num(props.data.value, 0))));
const percent = computed(() => (value.value / max.value) * 100);
const animated = computed(() => live.value && props.data.animated !== false);
const counted = useCountUp(() => value.value, () => 0, () => 1.2, () => animated.value);
const WIDTHS: Readonly<Record<string, number>> = { thin: 6, medium: 10, thick: 15 };
const stroke = computed(() => WIDTHS[str(props.data.thickness, 'medium')] ?? 10);
const radius = computed(() => 50 - stroke.value / 2 - 1);
const label = computed(() => str(props.data.label).trim());

const display = computed(() => {
  const mode = str(props.data.display, 'percent');
  const current = counted.value;
  if (mode === 'value') return formatNumber(current, Number.isInteger(value.value) ? 0 : 1);
  if (mode === 'fraction') return `${formatNumber(current, 0)}/${formatNumber(max.value, 0)}`;
  return `${formatNumber((current / max.value) * 100, 0)} %`;
});
</script>

<template>
  <div class="el-progress-ring" :data-animated="animated" :style="toneVars(data.color, 'success')" data-testid="progress-ring">
    <div class="ring" role="progressbar" :aria-valuemin="0" :aria-valuemax="max" :aria-valuenow="value" :aria-label="label || 'Progreso'">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" :r="radius" fill="none" class="track" :stroke-width="stroke" />
        <circle cx="50" cy="50" :r="radius" fill="none" class="fill" :stroke-width="stroke" pathLength="100" :stroke-dasharray="`${percent} 100`" stroke-linecap="round" />
      </svg>
      <span class="value" :data-long="display.length > 5">{{ display }}</span>
    </div>
    <span v-if="label" class="label">{{ label }}</span>
  </div>
</template>

<style scoped>
.el-progress-ring { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.8cqw; }
.ring { position: relative; flex: 1; min-height: 0; max-width: 100%; aspect-ratio: 1; }
svg { width: 100%; height: 100%; display: block; transform: rotate(-90deg); }
.track { stroke: var(--c-soft); }
.fill { stroke: var(--c); filter: drop-shadow(0 0 0.6cqw color-mix(in srgb, var(--c) 45%, transparent)); transition: stroke-dasharray 0.6s ease; }
[data-animated='true'] .fill { animation: ring-fill 1.2s ease-out both; }
.value { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 3cqw; font-weight: 600; color: var(--c-ink); font-variant-numeric: tabular-nums; }
.value[data-long='true'] { font-size: 2.2cqw; }
.label { flex: none; max-width: 100%; font-size: 1.45cqw; font-weight: 500; line-height: 1.25; color: var(--sl-fg-2); text-align: center; overflow-wrap: anywhere; }

@keyframes ring-fill {
  from { stroke-dasharray: 0 100; }
}
</style>
