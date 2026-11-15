<script setup lang="ts">
import { computed } from 'vue';
import { list, num, rec, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useMotion } from './motion.ts';
import { formatNumber, niceMax } from './render-helpers.ts';
import { colorKey, vividColor } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const { live } = useMotion(props);
const horizontal = computed(() => str(props.data.orientation, 'vertical') === 'horizontal');
const unit = computed(() => str(props.data.unit).trim());
const title = computed(() => str(props.data.title).trim());
const bars = computed(() => list(props.data.bars).map((item, index) => ({ label: str(rec(item).label), value: Math.max(0, num(rec(item).value)), color: colorKey(rec(item).color, vividColor(index)) })));
const top = computed(() => niceMax(Math.max(0, ...bars.value.map((bar) => bar.value))));
const ticks = computed(() => [1, 0.75, 0.5, 0.25, 0].map((share) => ({ share, value: formatNumber(top.value * share, top.value < 4 ? 1 : 0) })));

function valueText(value: number): string {
  return `${formatNumber(value, Number.isInteger(value) ? 0 : 1)}${unit.value ? ` ${unit.value}` : ''}`;
}
</script>

<template>
  <figure class="el-bar-chart" :data-horizontal="horizontal" :data-animated="live && data.animated !== false" :data-grid="data.showGrid !== false" data-testid="bar-chart">
    <figcaption v-if="title" class="title">{{ title }}</figcaption>
    <div class="plot" role="img" :aria-label="`${title || 'Gráfico de barras'}: ${bars.map((bar) => `${bar.label} ${valueText(bar.value)}`).join(', ')}`">
      <div class="grid" aria-hidden="true">
        <span v-for="tick in ticks" :key="tick.share" class="tick" :style="horizontal ? { left: `${tick.share * 100}%` } : { bottom: `${tick.share * 100}%` }"><span class="tick-label">{{ tick.value }}</span></span>
      </div>
      <div class="bars" :style="{ '--count': String(bars.length) }">
        <div v-for="(bar, index) in bars" :key="index" class="slot">
          <span class="track">
            <span class="bar" :style="{ '--share': String(top > 0 ? bar.value / top : 0), '--c': `var(--sl-${bar.color})`, '--c-grad': `var(--sl-${bar.color}-grad)`, animationDelay: `${index * 0.08}s` }">
              <span v-if="data.showValues !== false" class="value">{{ valueText(bar.value) }}</span>
            </span>
          </span>
          <span class="label">{{ bar.label }}</span>
        </div>
      </div>
    </div>
  </figure>
</template>

<style scoped>
.el-bar-chart { margin: 0; width: 100%; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 1cqw; padding: 1.4cqw 1.6cqw; background: var(--sl-card); border: 0.12cqw solid var(--sl-line); border-radius: 1.6cqw; box-shadow: var(--sl-elev-1); }
.title { font-size: 1.7cqw; font-weight: 600; color: var(--sl-ink); }
.plot { position: relative; flex: 1; min-height: 0; padding: 1.8cqw 0 0 3cqw; }
[data-horizontal='true'] .plot { padding: 0 4cqw 2.2cqw 0; }
/* The grid covers exactly the area where bars grow: below the value labels and beside the axis labels. */
.grid { position: absolute; inset: 1.8cqw 0 2.6cqw 3cqw; pointer-events: none; }
[data-horizontal='true'] .grid { inset: 0 4cqw 2.2cqw 11cqw; }
.tick { position: absolute; left: 0; right: 0; height: 0; border-top: 0.12cqw dashed var(--sl-line-2); }
[data-horizontal='true'] .tick { top: 0; bottom: 0; right: auto; width: 0; height: auto; border-top: 0; border-left: 0.12cqw dashed var(--sl-line-2); }
[data-grid='false'] .tick { border-color: transparent; }
[data-grid='false'] .tick:last-child { border-color: var(--sl-line-2); }
.tick-label { position: absolute; left: -0.6cqw; top: 0; transform: translate(-100%, -50%); font-size: 1.05cqw; color: var(--sl-ink-4); white-space: nowrap; }
[data-horizontal='true'] .tick-label { left: 0; top: calc(100% + 0.4cqw); transform: translateX(-50%); }
.bars { position: relative; height: 100%; display: grid; grid-template-columns: repeat(var(--count), 1fr); gap: 1.4cqw; }
[data-horizontal='true'] .bars { grid-template-columns: 1fr; grid-template-rows: repeat(var(--count), 1fr); gap: 0.7cqw; }
.slot { min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 0.5cqw; }
[data-horizontal='true'] .slot { flex-direction: row-reverse; align-items: center; gap: 1cqw; }
.track { position: relative; flex: 1; min-height: 0; display: flex; align-items: flex-end; justify-content: center; }
[data-horizontal='true'] .track { height: 100%; align-items: center; justify-content: flex-start; }
.bar { position: relative; width: min(100%, 7cqw); height: calc(var(--share) * 100%); min-height: 0.3cqw; border-radius: 0.8cqw 0.8cqw 0.2cqw 0.2cqw; background: var(--c-grad); transform-origin: bottom center; }
[data-horizontal='true'] .bar { width: calc(var(--share) * 100%); height: min(100%, 4cqw); min-width: 0.3cqw; border-radius: 0.2cqw 0.8cqw 0.8cqw 0.2cqw; transform-origin: left center; }
[data-animated='true'] .bar { animation: bar-grow 0.8s var(--sl-ease-bounce) both; }
[data-animated='true'][data-horizontal='true'] .bar { animation-name: bar-grow-x; }
.value { position: absolute; left: 50%; bottom: calc(100% + 0.4cqw); transform: translateX(-50%); font-size: 1.25cqw; font-weight: 600; color: var(--sl-ink); white-space: nowrap; }
[data-horizontal='true'] .value { left: calc(100% + 0.6cqw); bottom: auto; top: 50%; transform: translateY(-50%); }
.label { height: 2.1cqw; flex: none; font-size: 1.2cqw; line-height: 2.1cqw; color: var(--sl-ink-2); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
[data-horizontal='true'] .label { width: 10cqw; height: auto; line-height: 1.2; text-align: right; }

@keyframes bar-grow {
  from { transform: scaleY(0); }
  to { transform: none; }
}

@keyframes bar-grow-x {
  from { transform: scaleX(0); }
  to { transform: none; }
}
</style>
