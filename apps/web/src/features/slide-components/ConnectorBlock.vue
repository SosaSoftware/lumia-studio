<script setup lang="ts">
import { computed } from 'vue';
import { SLIDE_HEIGHT, SLIDE_WIDTH, THEME_COLOR_KEYS } from '@lumia/packages/catalog';
import { str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useSlideContext } from './slide-context.ts';

const props = defineProps<CatalogComponentProps>();
const context = useSlideContext();
const color = computed(() => `var(--sl-${THEME_COLOR_KEYS.find((key) => key === props.data.color) ?? 'muted'})`);
const elbow = computed(() => str(props.data.style) === 'elbow');
const fromId = computed(() => str(props.data.fromElementId));
const toId = computed(() => str(props.data.toElementId));
const free = computed(() => fromId.value === '' && toId.value === '');

/** Ends between the centers of the two elements, in slide units; null when one of them does not exist. */
const ends = computed(() => {
  if (free.value) return null;
  const elements = context.elements();
  const self = elements.find((element) => element.id === props.elementId);
  const from = elements.find((element) => element.id === fromId.value);
  const to = elements.find((element) => element.id === toId.value);
  if (self === undefined || from === undefined || to === undefined) return null;
  return { self, a: { x: from.x + from.w / 2, y: from.y + from.h / 2 }, b: { x: to.x + to.w / 2, y: to.y + to.h / 2 } };
});

const path = computed(() => {
  const value = ends.value;
  if (value === null) return '';
  const { a, b } = value;
  if (!elbow.value) return `M${String(a.x)} ${String(a.y)} L${String(b.x)} ${String(b.y)}`;
  const middle = (a.x + b.x) / 2;
  return `M${String(a.x)} ${String(a.y)} H${String(middle)} V${String(b.y)} H${String(b.x)}`;
});
</script>

<template>
  <div class="el-connector" role="img" aria-label="Conector">
    <template v-if="free">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true" class="free">
        <path :d="elbow ? 'M0 30 H50 V10 H100' : 'M0 30 C 45 30, 55 10, 100 10'" fill="none" :style="{ stroke: color }" stroke-width="2.5" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" />
      </svg>
      <span class="end" :style="{ left: '0', top: '75%', background: color }"></span>
      <span class="end" :style="{ left: '100%', top: '25%', background: color }"></span>
    </template>
    <svg
      v-else-if="ends"
      class="linked"
      :viewBox="`0 0 ${SLIDE_WIDTH} ${SLIDE_HEIGHT}`"
      aria-hidden="true"
      :style="{ left: `calc(-1cqw * ${ends.self.x})`, top: `calc(-1cqw * ${ends.self.y})` }"
    >
      <path :d="path" fill="none" :style="{ stroke: color }" stroke-width="2.5" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" />
      <circle :cx="ends.a.x" :cy="ends.a.y" r="0.7" :style="{ fill: color }" />
      <circle :cx="ends.b.x" :cy="ends.b.y" r="0.7" :style="{ fill: color }" />
    </svg>
    <div v-else-if="mode === 'edit'" class="warning">Elige dos elementos para conectar</div>
  </div>
</template>

<style scoped>
.el-connector { position: relative; width: 100%; height: 100%; }
.free { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.end { position: absolute; width: 1.4cqw; height: 1.4cqw; border-radius: 50%; transform: translate(-50%, -50%); }
.linked { position: absolute; width: 100cqw; height: 56.25cqw; overflow: visible; pointer-events: none; }
.warning { width: 100%; height: 100%; box-sizing: border-box; display: flex; align-items: center; justify-content: center; padding: 0.6cqw; border: 0.15cqw dashed var(--sl-red-ink); border-radius: 1cqw; color: var(--sl-red-ink); font-size: 1.2cqw; text-align: center; }
</style>
