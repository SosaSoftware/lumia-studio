<script setup lang="ts">
import { computed, ref } from 'vue';
import { num, str } from '../../api/decode.ts';
import { isSide, linkElements } from './arrow-geometry.ts';
import type { Anchor, RouteStyle } from './arrow-geometry.ts';
import { useBoxSize } from './box-size.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useMotion } from './motion.ts';
import { uniqueId } from './render-helpers.ts';
import { useSlideContext } from './slide-context.ts';
import { toneVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const context = useSlideContext();
const { ambient } = useMotion(props);
const root = ref<HTMLElement | null>(null);
const { width, height, unit } = useBoxSize(root);
const markerId = uniqueId('arrow-head');

const direction = computed(() => str(props.data.direction, 'right'));
const DIRECTIONS: Readonly<Record<string, string>> = { right: 'derecha', left: 'izquierda', up: 'arriba', down: 'abajo' };
const line = computed(() => str(props.data.line, 'solid'));
const double = computed(() => props.data.doubleHead === true);
const style = computed<RouteStyle>(() => {
  const value = str(props.data.style, 'straight');
  return value === 'curved' || value === 'elbow' ? value : 'straight';
});

/** Stroke in slide units: `0.15` per step plus a base, the same scale as the rest of the slide. */
const strokeUnits = computed(() => 0.15 * num(props.data.strokeWidth, 2) + 0.15);
/** Stroke in pixels, for the free arrow that is drawn in the pixels of its own frame. */
const stroke = computed(() => strokeUnits.value * unit.value);

function dashFor(size: number): string | undefined {
  if (line.value === 'dashed') return `${String(size * 3)} ${String(size * 2)}`;
  if (line.value === 'dotted') return `0.01 ${String(size * 2)}`;
  return undefined;
}

// --- Arrow that joins two elements -------------------------------------------------------------------------------

const fromId = computed(() => str(props.data.fromElementId));
const toId = computed(() => str(props.data.toElementId));
const linkedIds = computed(() => fromId.value !== '' && toId.value !== '');
const halfLinked = computed(() => (fromId.value === '') !== (toId.value === ''));

function anchorOf(value: unknown): Anchor {
  return isSide(value) ? value : 'auto';
}

/** Route between the two elements; null when one of them is missing. Arrow heads end on the borders. */
const linked = computed(() => {
  if (!linkedIds.value) return null;
  const elements = context.elements();
  const self = elements.find((element) => element.id === props.elementId);
  const from = elements.find((element) => element.id === fromId.value);
  const to = elements.find((element) => element.id === toId.value);
  if (self === undefined || from === undefined || to === undefined) return null;
  const headLength = strokeUnits.value * 1.6;
  const route = linkElements(from, to, anchorOf(props.data.fromAnchor), anchorOf(props.data.toAnchor), style.value, 0.6, double.value ? headLength : 0, headLength);
  // The drawing is as big as the frame of the arrow and shows the slide through a viewBox that starts at the frame.
  // The line leaves the frame and paints outside it, which does not count as content: the editor would otherwise
  // grow the frame down to the bottom of the slide to hold it.
  return { self, view: `${String(self.x)} ${String(self.y)} ${String(Math.max(self.w, 0.01))} ${String(Math.max(self.h, 0.01))}`, ...route };
});

// --- Free arrow ---------------------------------------------------------------------------------------------------

/**
 * Path from tail to tip in pixels. Ends stay inside the frame by the length of the head, which a marker of
 * `4 × stroke` draws.
 */
const freePath = computed(() => {
  const w = width.value;
  const h = height.value;
  if (w === 0 || h === 0) return '';
  const head = stroke.value * 3.2;
  const vertical = direction.value === 'up' || direction.value === 'down';
  const along = vertical ? h : w;
  const across = vertical ? w : h;
  const startPad = double.value ? head : stroke.value / 2;
  let a = startPad;
  let b = along - head;
  if (direction.value === 'left' || direction.value === 'up') [a, b] = [along - startPad, head];
  const curved = style.value === 'curved';
  const baseline = curved ? across * 0.78 : across / 2;
  // A quadratic curve peaks halfway between its baseline and its control point.
  const peak = Math.max(stroke.value * 2, across * 0.12);
  const control = 2 * peak - baseline;
  const point = (t: number, c: number): string => (vertical ? `${String(c)} ${String(t)}` : `${String(t)} ${String(c)}`);
  if (!curved) return `M${point(a, baseline)} L${point(b, baseline)}`;
  return `M${point(a, baseline)} Q${point((a + b) / 2, control)} ${point(b, baseline)}`;
});

/** The arrow nudges forward when animated and solid; dashed lines flow instead. */
const motion = computed(() => (ambient.value && props.data.animated === true ? (line.value === 'solid' ? 'nudge' : 'flow') : 'none'));
const label = computed(() => (linked.value === null ? `Flecha hacia ${DIRECTIONS[direction.value] ?? 'la derecha'}` : 'Flecha que une dos elementos'));
</script>

<template>
  <div ref="root" class="el-arrow" role="img" :aria-label="label" :data-motion="motion" :data-direction="direction" :style="toneVars(data.color, 'accent')">
    <svg v-if="linked" class="linked" :viewBox="linked.view" preserveAspectRatio="none" aria-hidden="true" :style="{ width: `${linked.self.w}cqw`, height: `${linked.self.h}cqw` }">
      <defs>
        <marker :id="markerId" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse" markerUnits="strokeWidth">
          <path d="M0 0 L10 5 L0 10 L2.5 5 z" class="head" />
        </marker>
      </defs>
      <path
        :d="linked.path"
        class="shaft"
        fill="none"
        :stroke-width="strokeUnits"
        :stroke-dasharray="dashFor(strokeUnits)"
        :stroke-linecap="line === 'dotted' ? 'round' : 'butt'"
        stroke-linejoin="round"
        :marker-end="`url(#${markerId})`"
        :marker-start="double ? `url(#${markerId})` : undefined"
        :style="{ '--dash-step': `${strokeUnits * 5}px` }"
      />
    </svg>
    <div v-else-if="linkedIds || halfLinked" class="warning">{{ halfLinked ? 'Elige el elemento de origen y el de destino' : 'Alguno de los elementos unidos ya no existe' }}</div>
    <svg v-else-if="freePath" :viewBox="`0 0 ${width} ${height}`" :width="width" :height="height" aria-hidden="true" class="free">
      <defs>
        <marker :id="markerId" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse" markerUnits="strokeWidth">
          <path d="M0 0 L10 5 L0 10 L2.5 5 z" class="head" />
        </marker>
      </defs>
      <path
        :d="freePath"
        class="shaft"
        fill="none"
        :stroke-width="stroke"
        :stroke-dasharray="dashFor(stroke)"
        :stroke-linecap="line === 'dotted' ? 'round' : 'butt'"
        :marker-end="`url(#${markerId})`"
        :marker-start="double ? `url(#${markerId})` : undefined"
        :style="{ '--dash-step': `${stroke * 5}px` }"
      />
    </svg>
  </div>
</template>

<style scoped>
.el-arrow { position: relative; width: 100%; height: 100%; overflow: visible; }
svg { display: block; overflow: visible; }
.linked { position: absolute; left: 0; top: 0; pointer-events: none; }
.shaft { stroke: var(--c); }
.head { fill: var(--c); }
.warning { width: 100%; height: 100%; box-sizing: border-box; display: flex; align-items: center; justify-content: center; padding: 0.6cqw; border: 0.15cqw dashed var(--sl-red-ink); border-radius: 1cqw; color: var(--sl-red-ink); font-size: 1.2cqw; text-align: center; }
[data-motion='flow'] .shaft { animation: arrow-flow 0.8s linear infinite; }
[data-motion='nudge'] .free { animation: arrow-nudge-x 1.2s ease-in-out infinite; }
[data-motion='nudge'][data-direction='left'] .free { animation-name: arrow-nudge-x-back; }
[data-motion='nudge'][data-direction='down'] .free { animation-name: arrow-nudge-y; }
[data-motion='nudge'][data-direction='up'] .free { animation-name: arrow-nudge-y-back; }

@keyframes arrow-flow {
  to { stroke-dashoffset: calc(-1 * var(--dash-step)); }
}

@keyframes arrow-nudge-x {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(6%); }
}

@keyframes arrow-nudge-x-back {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(-6%); }
}

@keyframes arrow-nudge-y {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(6%); }
}

@keyframes arrow-nudge-y-back {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6%); }
}
</style>
