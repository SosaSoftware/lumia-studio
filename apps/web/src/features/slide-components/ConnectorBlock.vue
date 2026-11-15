<script setup lang="ts">
import { computed } from 'vue';
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '@lumia/packages/catalog';
import type { SlideElement } from '../../api/types.ts';
import { num, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useMotion } from './motion.ts';
import { uniqueId } from './render-helpers.ts';
import { useSlideContext } from './slide-context.ts';
import { toneVars } from './tone.ts';

interface Point {
  x: number;
  y: number;
}

const props = defineProps<CatalogComponentProps>();
const context = useSlideContext();
const { ambient } = useMotion(props);
const markerId = uniqueId('connector-head');
const style = computed(() => str(props.data.style, 'straight'));
const fromId = computed(() => str(props.data.fromElementId));
const toId = computed(() => str(props.data.toElementId));
const free = computed(() => fromId.value === '' && toId.value === '');
const line = computed(() => str(props.data.line, 'dashed'));
/** Stroke in slide units (`cqw`), the coordinate system of the linked drawing. */
const stroke = computed(() => num(props.data.strokeWidth, 2.5) * 0.12);
const dash = computed(() => {
  const size = stroke.value;
  if (line.value === 'dashed') return `${String(size * 2.4)} ${String(size * 1.6)}`;
  if (line.value === 'dotted') return `0.01 ${String(size * 2)}`;
  return undefined;
});
const head = computed(() => props.data.arrowHead === true);
const flowing = computed(() => ambient.value && props.data.animated === true);

function center(element: SlideElement): Point {
  return { x: element.x + element.w / 2, y: element.y + element.h / 2 };
}

/** Point where the segment from the center of `box` towards `toward` leaves the box, pushed out by `gap`. */
function exitPoint(box: SlideElement, toward: Point, gap: number): Point {
  const origin = center(box);
  const dx = toward.x - origin.x;
  const dy = toward.y - origin.y;
  if (dx === 0 && dy === 0) return origin;
  const scale = Math.min(dx === 0 ? Infinity : (box.w / 2 + gap) / Math.abs(dx), dy === 0 ? Infinity : (box.h / 2 + gap) / Math.abs(dy));
  return { x: origin.x + dx * Math.min(1, scale), y: origin.y + dy * Math.min(1, scale) };
}

/** Self frame and both linked elements; null when one of them does not exist. */
const linked = computed(() => {
  if (free.value) return null;
  const elements = context.elements();
  const self = elements.find((element) => element.id === props.elementId);
  const from = elements.find((element) => element.id === fromId.value);
  const to = elements.find((element) => element.id === toId.value);
  if (self === undefined || from === undefined || to === undefined) return null;
  return { self, from, to };
});

/** The line leaves and enters the borders of the elements, so the arrow head stays visible. */
const geometry = computed(() => {
  const value = linked.value;
  if (value === null) return null;
  const gap = 0.8;
  const { from, to } = value;
  const a0 = center(from);
  const b0 = center(to);
  if (style.value === 'straight') {
    const a = exitPoint(from, b0, gap);
    const b = exitPoint(to, a0, gap + (head.value ? stroke.value * 2 : 0));
    return { a, b, d: `M${String(a.x)} ${String(a.y)} L${String(b.x)} ${String(b.y)}` };
  }
  const sign = b0.x >= a0.x ? 1 : -1;
  const a = { x: a0.x + sign * (from.w / 2 + gap), y: a0.y };
  const b = { x: b0.x - sign * (to.w / 2 + gap + (head.value ? stroke.value * 2 : 0)), y: b0.y };
  const middle = (a.x + b.x) / 2;
  const d =
    style.value === 'elbow'
      ? `M${String(a.x)} ${String(a.y)} H${String(middle)} V${String(b.y)} H${String(b.x)}`
      : `M${String(a.x)} ${String(a.y)} C${String(middle)} ${String(a.y)} ${String(middle)} ${String(b.y)} ${String(b.x)} ${String(b.y)}`;
  return { a, b, d };
});

const freePath = computed(() => (style.value === 'elbow' ? 'M0 30 H50 V10 H100' : style.value === 'curved' ? 'M0 30 C 45 30, 55 10, 100 10' : 'M0 30 L100 10'));
</script>

<template>
  <div class="el-connector" role="img" aria-label="Conector" :data-flow="flowing" :style="toneVars(data.color, 'muted')">
    <template v-if="free">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true" class="free">
        <path :d="freePath" fill="none" class="stroke" stroke-width="2.5" :stroke-dasharray="line === 'solid' ? undefined : line === 'dotted' ? '0.01 5' : '6 4'" stroke-linecap="round" vector-effect="non-scaling-stroke" />
      </svg>
      <span class="end" :style="{ left: '0', top: '75%' }"></span>
      <span class="end" :style="{ left: '100%', top: '25%' }"></span>
    </template>
    <svg
      v-else-if="linked && geometry"
      class="linked"
      :viewBox="`0 0 ${SLIDE_WIDTH} ${SLIDE_HEIGHT}`"
      aria-hidden="true"
      :style="{ left: `calc(-1cqw * ${linked.self.x})`, top: `calc(-1cqw * ${linked.self.y})` }"
    >
      <defs>
        <marker :id="markerId" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="4" markerHeight="4" orient="auto" markerUnits="strokeWidth">
          <path d="M0 0 L10 5 L0 10 L2.5 5 z" class="fill" />
        </marker>
      </defs>
      <path
        :d="geometry.d"
        fill="none"
        class="stroke line"
        :stroke-width="stroke"
        :stroke-dasharray="dash"
        :stroke-linecap="line === 'dotted' ? 'round' : 'butt'"
        stroke-linejoin="round"
        :marker-end="head ? `url(#${markerId})` : undefined"
        :style="{ '--dash-step': `${stroke * 4}px` }"
      />
      <circle :cx="geometry.a.x" :cy="geometry.a.y" :r="stroke * 1.6" class="fill" />
      <circle v-if="!head" :cx="geometry.b.x" :cy="geometry.b.y" :r="stroke * 1.6" class="fill" />
    </svg>
    <div v-else-if="mode === 'edit'" class="warning">Elige dos elementos para conectar</div>
  </div>
</template>

<style scoped>
.el-connector { position: relative; width: 100%; height: 100%; }
.stroke { stroke: var(--c); }
.fill { fill: var(--c); }
.free { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.end { position: absolute; width: 1.4cqw; height: 1.4cqw; border-radius: 50%; transform: translate(-50%, -50%); background: var(--c); }
.linked { position: absolute; width: 100cqw; height: 56.25cqw; overflow: visible; pointer-events: none; }
[data-flow='true'] .line { animation: connector-flow 0.9s linear infinite; }
.warning { width: 100%; height: 100%; box-sizing: border-box; display: flex; align-items: center; justify-content: center; padding: 0.6cqw; border: 0.15cqw dashed var(--sl-red-ink); border-radius: 1cqw; color: var(--sl-red-ink); font-size: 1.2cqw; text-align: center; }

@keyframes connector-flow {
  to { stroke-dashoffset: calc(-1 * var(--dash-step)); }
}
</style>
