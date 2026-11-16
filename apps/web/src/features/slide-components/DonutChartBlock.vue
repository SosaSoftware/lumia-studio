<script setup lang="ts">
import { computed } from 'vue';
import { list, num, rec, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useMotion } from './motion.ts';
import { formatNumber } from './render-helpers.ts';
import { colorKey, vividColor } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const { live } = useMotion(props);
const pie = computed(() => str(props.data.kind, 'donut') === 'pie');
const title = computed(() => str(props.data.title).trim());
const raw = computed(() => list(props.data.segments).map((item, index) => ({ label: str(rec(item).label), value: Math.max(0, num(rec(item).value)), color: colorKey(rec(item).color, vividColor(index)) })));
const total = computed(() => raw.value.reduce((sum, segment) => sum + segment.value, 0));

/** Segments as shares of a circumference of 100, each starting where the previous one ends. */
const segments = computed(() => {
  let start = 0;
  return raw.value.map((segment) => {
    const share = total.value > 0 ? (segment.value / total.value) * 100 : 0;
    const item = { ...segment, share, start };
    start += share;
    return item;
  });
});
const center = computed(() => str(props.data.centerValue).trim() || formatNumber(total.value, Number.isInteger(total.value) ? 0 : 1));
const centerLabel = computed(() => str(props.data.centerLabel).trim());
/** A pie is a circle of radius 25 stroked 50 wide, which paints it to the center. */
const radius = computed(() => (pie.value ? 25 : 38));
const stroke = computed(() => (pie.value ? 50 : 15));
</script>

<template>
  <figure class="el-donut" :data-animated="live && data.animated !== false" :data-legend="data.showLegend !== false" data-testid="donut-chart">
    <figcaption v-if="title" class="title">{{ title }}</figcaption>
    <div class="body">
      <div class="chart">
        <svg viewBox="0 0 100 100" role="img" :aria-label="`${title || 'Gráfico'}: ${segments.map((segment) => `${segment.label} ${Math.round(segment.share)} %`).join(', ')}`">
          <circle v-if="!pie" cx="50" cy="50" :r="radius" fill="none" class="rest" :stroke-width="stroke" />
          <circle
            v-for="(segment, index) in segments"
            :key="index"
            cx="50"
            cy="50"
            :r="radius"
            fill="none"
            pathLength="100"
            class="segment"
            :stroke-width="stroke"
            :stroke-dasharray="`${segment.share} ${100 - segment.share}`"
            :stroke-dashoffset="-segment.start"
            :style="{ stroke: `var(--sl-${segment.color})`, animationDelay: `${index * 0.15}s` }"
          />
        </svg>
        <span v-if="!pie" class="center" aria-hidden="true">
          <span class="center-value">{{ center }}</span>
          <span v-if="centerLabel" class="center-label">{{ centerLabel }}</span>
        </span>
      </div>
      <ul v-if="data.showLegend !== false" class="legend">
        <li v-for="(segment, index) in segments" :key="index" class="entry">
          <span class="swatch" :style="{ background: `var(--sl-${segment.color})` }" aria-hidden="true"></span>
          <span class="entry-label">{{ segment.label }}</span>
          <span v-if="data.showPercent !== false" class="entry-value">{{ formatNumber(segment.share, segment.share > 0 && segment.share < 10 && !Number.isInteger(segment.share) ? 1 : 0) }} %</span>
        </li>
      </ul>
    </div>
  </figure>
</template>

<style scoped>
.el-donut { margin: 0; width: 100%; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 1cqw; }
.title { font-size: 1.7cqw; font-weight: 600; color: var(--sl-fg); }
.body { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; gap: 2.4cqw; }
.chart { position: relative; height: 100%; max-width: 60%; aspect-ratio: 1; flex: none; }
svg { width: 100%; height: 100%; display: block; transform: rotate(-90deg); overflow: visible; }
.rest { stroke: var(--sl-line); }
.segment { transition: stroke-width 0.2s ease; }
.segment:hover { stroke-width: 18; }
[data-animated='true'] .segment { animation: donut-draw 0.9s ease-out both; }
.center { position: absolute; inset: 22%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.center-value { font-size: 2.6cqw; font-weight: 600; line-height: 1; color: var(--sl-fg); white-space: nowrap; }
.center-label { margin-top: 0.4cqw; font-size: 1.1cqw; line-height: 1.2; color: var(--sl-fg-2); overflow-wrap: anywhere; }
.legend { list-style: none; margin: 0; padding: 0; min-width: 0; display: flex; flex-direction: column; gap: 0.8cqw; }
.entry { display: flex; align-items: center; gap: 0.8cqw; font-size: 1.4cqw; }
.swatch { width: 1.4cqw; height: 1.4cqw; flex: none; border-radius: 0.4cqw; }
.entry-label { min-width: 0; color: var(--sl-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.entry-value { margin-left: auto; padding-left: 0.8cqw; font-weight: 600; color: var(--sl-fg-2); }

@keyframes donut-draw {
  from { stroke-dasharray: 0 100; }
}
</style>
