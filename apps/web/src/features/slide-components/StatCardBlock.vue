<script setup lang="ts">
import { computed } from 'vue';
import { str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useMotion } from './motion.ts';
import { fillVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const { live } = useMotion(props);
const trend = computed(() => str(props.data.trend, 'none'));
const trendText = computed(() => str(props.data.trendText).trim());
const emoji = computed(() => str(props.data.emoji).trim());

const TRENDS: Readonly<Record<string, { path: string; label: string }>> = {
  up: { path: 'M7 17 17 7M9 7h8v8', label: 'Sube' },
  down: { path: 'M7 7l10 10M17 9v8H9', label: 'Baja' },
  neutral: { path: 'M5 12h14M13 6l6 6-6 6', label: 'Estable' },
};
</script>

<template>
  <div class="el-stat-card" :data-animated="live" :style="fillVars(data.color, data.variant, 'primary')" data-testid="stat-card">
    <span v-if="emoji" class="tile" aria-hidden="true">{{ emoji }}</span>
    <span class="copy">
      <span class="value">{{ str(data.value) }}</span>
      <span class="label">{{ str(data.label) }}</span>
    </span>
    <span v-if="trend !== 'none' && TRENDS[trend]" class="trend" :data-trend="trend" :aria-label="`${TRENDS[trend]?.label}${trendText ? `: ${trendText}` : ''}`">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="TRENDS[trend]?.path" /></svg>
      <span v-if="trendText">{{ trendText }}</span>
    </span>
  </div>
</template>

<style scoped>
.el-stat-card { width: 100%; height: 100%; box-sizing: border-box; display: flex; align-items: center; gap: 1.6cqw; padding: 1.4cqw 1.8cqw; background: var(--sl-card); border: 0.12cqw solid var(--sl-line); border-radius: 1.6cqw; box-shadow: var(--sl-elev-2); overflow: hidden; }
[data-animated='true'] { animation: sl-rise 0.5s ease-out both; }
.tile { width: 5.6cqw; height: 5.6cqw; flex: none; display: flex; align-items: center; justify-content: center; border-radius: 1.4cqw; background: var(--fill); font-size: 2.8cqw; line-height: 1; box-shadow: 0 0.4cqw 1cqw color-mix(in srgb, var(--c) 30%, transparent); }
[data-animated='true'] .tile { animation: sl-zoom 0.5s 0.15s var(--sl-ease-bounce) both; }
.copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.3cqw; }
.value { font-size: 3.4cqw; font-weight: 600; line-height: 1; letter-spacing: -0.01em; color: var(--sl-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.label { font-size: 1.35cqw; line-height: 1.3; color: var(--sl-ink-2); overflow-wrap: anywhere; }
.trend { flex: none; align-self: flex-start; display: inline-flex; align-items: center; gap: 0.4cqw; padding: 0.4cqw 0.9cqw; border-radius: 0.8cqw; font-size: 1.2cqw; font-weight: 600; white-space: nowrap; }
.trend svg { width: 1.4cqw; height: 1.4cqw; fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
.trend[data-trend='up'] { background: var(--sl-success-soft); color: var(--sl-success-ink); }
.trend[data-trend='down'] { background: var(--sl-danger-soft); color: var(--sl-danger-ink); }
.trend[data-trend='neutral'] { background: var(--sl-muted-soft); color: var(--sl-muted-ink); }
</style>
