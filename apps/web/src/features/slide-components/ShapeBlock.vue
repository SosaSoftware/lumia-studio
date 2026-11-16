<script setup lang="ts">
import { computed, ref } from 'vue';
import { num, str } from '../../api/decode.ts';
import ArrowGlyph from './ArrowGlyph.vue';
import { useBoxSize } from './box-size.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { uniqueId } from './render-helpers.ts';
import { BOX_SHAPES, EQUAL_SIDES, SHAPE_OUTLINES } from './shape-outlines.ts';
import { colorKey, variantOf } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const clipId = uniqueId('shape-clip');
const root = ref<HTMLElement | null>(null);
const { width, height } = useBoxSize(root);
const kind = computed(() => str(props.data.kind, 'rectangle'));
const fill = computed(() => colorKey(props.data.fill, 'surface-alt'));
const stroke = computed(() => colorKey(props.data.stroke, 'accent'));
const weight = computed(() => num(props.data.strokeWidth, 1));
/** Shapes made before the variant existed keep their soft tint. */
const variant = computed(() => variantOf(props.data.variant, 'soft'));
const text = computed(() => str(props.data.text).trim());
const outline = computed(() => SHAPE_OUTLINES[kind.value] ?? null);
const equal = computed(() => EQUAL_SIDES.has(kind.value));
/** Square and circle take the smaller side of the frame, measured in pixels because `cqw` here belongs to the slide. */
const side = computed(() => (equal.value && width.value > 0 && height.value > 0 ? `${String(Math.min(width.value, height.value))}px` : null));

const NAMES: Readonly<Record<string, string>> = {
  rectangle: 'Rectángulo',
  rounded: 'Rectángulo redondeado',
  square: 'Cuadrado',
  ellipse: 'Elipse',
  circle: 'Círculo',
  triangle: 'Triángulo',
  right_triangle: 'Triángulo rectángulo',
  diamond: 'Rombo',
  parallelogram: 'Paralelogramo',
  trapezoid: 'Trapecio',
  pentagon: 'Pentágono',
  hexagon: 'Hexágono',
  octagon: 'Octágono',
  star: 'Estrella',
  heart: 'Corazón',
  cross: 'Cruz',
  line: 'Línea',
  arrow: 'Flecha',
};
const name = computed(() => NAMES[kind.value] ?? 'Forma');

const paint = computed(() => {
  const key = fill.value;
  if (variant.value === 'solid') return { background: `var(--sl-${key})`, color: `var(--sl-on-${key})` };
  if (variant.value === 'gradient') return { background: `var(--sl-${key}-grad)`, color: `var(--sl-on-${key})` };
  return { background: `var(--sl-${key}-soft)`, color: `var(--sl-${key}-ink)` };
});

const radius = computed(() => {
  switch (kind.value) {
    case 'ellipse':
    case 'circle':
      return '50%';
    case 'rounded':
      return '3cqw';
    default:
      return '1.2cqw';
  }
});

const textBox = computed(() => {
  const [left, top, width, height] = outline.value?.text ?? [0, 0, 100, 100];
  return { left: `${String(left)}%`, top: `${String(top)}%`, width: `${String(width)}%`, height: `${String(height)}%` };
});
</script>

<template>
  <div ref="root" class="el-shape" role="img" :aria-label="text ? `${name}: ${text}` : name" :data-shadow="data.shadow === true">
    <div v-if="BOX_SHAPES.has(kind)" class="sq" :data-equal="equal">
      <div
        class="box"
        :style="{
          ...paint,
          ...(side === null ? {} : { width: side, height: side, flex: 'none' }),
          borderRadius: radius,
          border: weight > 0 ? `calc(${weight} * 0.12cqw) solid var(--sl-${stroke})` : '0',
        }"
      >
        <span v-if="text" class="label">{{ text }}</span>
      </div>
    </div>
    <div v-else-if="outline" class="poly">
      <svg class="defs" width="0" height="0" aria-hidden="true">
        <clipPath :id="clipId" clipPathUnits="objectBoundingBox"><path :d="outline.path" transform="scale(0.01)" /></clipPath>
      </svg>
      <div class="poly-fill" :style="{ ...paint, clipPath: `url(#${clipId})` }"></div>
      <svg v-if="weight > 0" class="poly-stroke" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path :d="outline.path" fill="none" :style="{ stroke: `var(--sl-${stroke})` }" :stroke-width="weight * 1.2" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
      </svg>
      <div v-if="text" class="poly-text" :style="{ ...textBox, color: paint.color }"><span class="label">{{ text }}</span></div>
    </div>
    <div v-else-if="kind === 'line'" class="line-wrap"><span class="line" :style="{ height: `max(0.2cqw, ${weight * 0.15}cqw)`, background: `var(--sl-${stroke})` }"></span></div>
    <ArrowGlyph v-else :color="`var(--sl-${stroke})`" :weight="Math.max(1, weight)" />
  </div>
</template>

<style scoped>
.el-shape { width: 100%; height: 100%; }
.sq { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.box { width: 100%; height: 100%; box-sizing: border-box; display: flex; align-items: center; justify-content: center; padding: 0.8cqw; }
[data-shadow='true'] .box { box-shadow: var(--sl-elev-2); }
[data-shadow='true'] .poly { filter: drop-shadow(0 0.5cqw 0.8cqw rgba(22, 22, 22, 0.18)); }
.poly { position: relative; width: 100%; height: 100%; }
.defs { position: absolute; }
.poly-fill { position: absolute; inset: 0; }
.poly-stroke { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.poly-text { position: absolute; display: flex; align-items: center; justify-content: center; }
.label { max-width: 100%; font-size: 1.7cqw; font-weight: 600; line-height: 1.2; text-align: center; overflow-wrap: anywhere; }
.line-wrap { width: 100%; height: 100%; display: flex; align-items: center; }
.line { flex: 1; border-radius: 0.3cqw; }
</style>
