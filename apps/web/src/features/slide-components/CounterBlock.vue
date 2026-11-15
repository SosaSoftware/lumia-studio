<script setup lang="ts">
import { computed } from 'vue';
import { num, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useCountUp, useMotion } from './motion.ts';
import { formatNumber } from './render-helpers.ts';
import { toneVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const { live } = useMotion(props);
const decimals = computed(() => Math.min(3, Math.max(0, Math.round(num(props.data.decimals, 0)))));
const current = useCountUp(
  () => num(props.data.value, 0),
  () => num(props.data.from, 0),
  () => num(props.data.durationS, 2),
  () => live.value,
);
const shown = computed(() => `${str(props.data.prefix)}${formatNumber(current.value, decimals.value)}${str(props.data.suffix)}`);
const final = computed(() => `${str(props.data.prefix)}${formatNumber(num(props.data.value, 0), decimals.value)}${str(props.data.suffix)}`);
const emoji = computed(() => str(props.data.emoji).trim());
const label = computed(() => str(props.data.label).trim());
</script>

<template>
  <div class="el-counter" :data-gradient="data.gradient !== false" :style="toneVars(data.color, 'primary')" data-testid="counter">
    <span v-if="emoji" class="emoji" aria-hidden="true">{{ emoji }}</span>
    <span class="value" role="status" :aria-label="`${final}${label ? ` ${label}` : ''}`">
      <!-- The final value reserves the width, so the counter does not jump while it counts. -->
      <span class="ghost" aria-hidden="true">{{ final }}</span>
      <span class="live" aria-hidden="true">{{ shown }}</span>
    </span>
    <span v-if="label" class="label">{{ label }}</span>
  </div>
</template>

<style scoped>
.el-counter { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5cqw; text-align: center; }
.emoji { font-size: 3.4cqw; line-height: 1; }
.value { position: relative; display: inline-grid; font-size: 6cqw; font-weight: 600; line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; color: var(--c); }
.value > span { grid-area: 1 / 1; }
.ghost { visibility: hidden; }
[data-gradient='true'] .live { background: var(--c-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; padding-bottom: 0.06em; }
.label { max-width: 100%; font-size: 1.6cqw; line-height: 1.3; color: var(--sl-fg-2); overflow-wrap: anywhere; }
</style>
