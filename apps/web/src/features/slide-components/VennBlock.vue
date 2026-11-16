<script setup lang="ts">
import { computed } from 'vue';
import { list, rec, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useMotion } from './motion.ts';
import { colorKey, vividColor } from './tone.ts';

interface Circle {
  label: string;
  items: string[];
  color: string;
  cx: number;
  cy: number;
  /** Where the label and the own items of the set are written, away from the shared area. */
  tx: number;
  ty: number;
  /** Offset the circle travels from when the diagram animates. */
  dx: number;
  dy: number;
}

/** Drawing coordinates: a 200 × 120 box, scaled to fit the frame without distortion. */
const WIDTH = 200;
const HEIGHT = 120;
const props = defineProps<CatalogComponentProps>();
const { live } = useMotion(props);
const shared = computed(() => list(props.data.shared).map((item) => str(item)).filter((item) => item !== ''));
const sharedLabel = computed(() => str(props.data.sharedLabel).trim());

const circles = computed<Circle[]>(() => {
  const sets = list(props.data.sets).slice(0, 3).map((item, index) => ({
    label: str(rec(item).label),
    items: list(rec(item).items).map((entry) => str(entry)).filter((entry) => entry !== ''),
    color: colorKey(rec(item).color, vividColor(index)),
  }));
  if (sets.length === 3) {
    const layout = [
      { cx: 78, cy: 46, tx: 58, ty: 30, dx: -14, dy: -8 },
      { cx: 122, cy: 46, tx: 142, ty: 30, dx: 14, dy: -8 },
      { cx: 100, cy: 82, tx: 100, ty: 100, dx: 0, dy: 14 },
    ];
    return sets.map((set, index) => ({ ...set, ...(layout[index] ?? { cx: 100, cy: 60, tx: 100, ty: 60, dx: 0, dy: 0 }) }));
  }
  const layout = [
    { cx: 72, cy: 60, tx: 52, ty: 60, dx: -18, dy: 0 },
    { cx: 128, cy: 60, tx: 148, ty: 60, dx: 18, dy: 0 },
  ];
  return sets.map((set, index) => ({ ...set, ...(layout[index] ?? { cx: 100, cy: 60, tx: 100, ty: 60, dx: 0, dy: 0 }) }));
});
const three = computed(() => circles.value.length === 3);
const radius = computed(() => (three.value ? 40 : 52));
const sharedY = computed(() => (three.value ? 58 : 60));

/** Vertical position of line `index` of `total` lines centered on `y`. */
function lineY(y: number, index: number, total: number, gap: number): number {
  return y + (index - (total - 1) / 2) * gap;
}
</script>

<template>
  <div class="el-venn" :data-animated="live && data.animated !== false" data-testid="venn">
    <svg :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" preserveAspectRatio="xMidYMid meet" role="img" :aria-label="`Diagrama de Venn: ${circles.map((circle) => `${circle.label} (${circle.items.join(', ')})`).join('; ')}; en común: ${shared.join(', ')}`">
      <g v-for="(circle, index) in circles" :key="`c-${index}`" class="set" :style="{ '--dx': `${circle.dx}px`, '--dy': `${circle.dy}px`, '--set': `var(--sl-${circle.color})`, '--set-ink': `var(--sl-${circle.color}-ink)`, animationDelay: `${index * 0.12}s` }">
        <circle :cx="circle.cx" :cy="circle.cy" :r="radius" class="disc" />
      </g>
      <g v-for="(circle, index) in circles" :key="`t-${index}`" class="copy" :style="{ '--set-ink': `var(--sl-${circle.color}-ink)` }">
        <text :x="circle.tx" :y="lineY(circle.ty, 0, circle.items.length + 1, 9) - (three ? 2 : 6)" class="label">{{ circle.label }}</text>
        <text v-for="(item, line) in circle.items" :key="line" :x="circle.tx" :y="lineY(circle.ty, line + 1, circle.items.length + 1, three ? 7.5 : 9)" class="item">{{ item }}</text>
      </g>
      <g class="copy shared">
        <text v-if="sharedLabel" x="100" :y="lineY(sharedY, 0, shared.length + 1, 8) - 2" class="label">{{ sharedLabel }}</text>
        <text v-for="(item, line) in shared" :key="line" x="100" :y="lineY(sharedY, line + (sharedLabel ? 1 : 0), shared.length + (sharedLabel ? 1 : 0), 7.5)" class="item">{{ item }}</text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.el-venn { width: 100%; height: 100%; }
svg { width: 100%; height: 100%; display: block; overflow: visible; }
.disc { fill: color-mix(in srgb, var(--set) 26%, transparent); stroke: var(--set); stroke-width: 1.2; mix-blend-mode: multiply; }
[data-animated='true'] .set { animation: venn-join 0.7s var(--sl-ease-bounce) both; }
text { text-anchor: middle; dominant-baseline: middle; font-family: inherit; }
.label { font-size: 8px; font-weight: 600; fill: var(--set-ink); }
.item { font-size: 6px; fill: var(--sl-ink-2); }
.shared .label { fill: var(--sl-ink); font-size: 6.5px; letter-spacing: 0.06em; text-transform: uppercase; }
.shared .item { fill: var(--sl-ink); font-weight: 600; }
[data-animated='true'] .copy { animation: sl-rise 0.4s 0.5s ease-out both; }

@keyframes venn-join {
  from { opacity: 0; transform: translate(var(--dx), var(--dy)); }
  to { opacity: 1; transform: none; }
}
</style>
