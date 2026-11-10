<script setup lang="ts">
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '@lumia/packages/catalog';
import { canvasMargins, defaultMargin } from '../../composables/canvas-margins.ts';
import { t } from '../../i18n/index.ts';
import type { MarginSide } from '../../composables/canvas-margins.ts';
import type { Geometry } from './geometry.ts';
import { MarginDrag, marginLine } from './margin-lines.ts';

/**
 * Rulers along the top and the left of the slide, in the units of the editor (the slide is 100 wide). Each one
 * shades its two margins and has a marker on each margin that the person can drag; the selected element shows as a
 * band. Editing aids: they are not part of the class.
 */
const props = defineProps<{ slideWidth: () => number; selection: Geometry | null }>();

type Orientation = 'horizontal' | 'vertical';

interface RulerSpec {
  readonly orientation: Orientation;
  /** Length of the slide on this axis, in `cqw`. */
  readonly length: number;
  /** Margins at the start and at the end of the axis. */
  readonly sides: readonly [MarginSide, MarginSide];
}

const RULERS: readonly RulerSpec[] = [
  { orientation: 'horizontal', length: SLIDE_WIDTH, sides: ['left', 'right'] },
  { orientation: 'vertical', length: SLIDE_HEIGHT, sides: ['top', 'bottom'] },
];

/** Distance between two ticks, and between two numbered ticks, in `cqw`. */
const TICK_STEP = 2;
const LABEL_STEP = 10;

function ticksOf(length: number): number[] {
  const ticks: number[] = [];
  for (let value = 0; value <= length; value += TICK_STEP) ticks.push(value);
  return ticks;
}

const TICKS: Record<Orientation, number[]> = { horizontal: ticksOf(SLIDE_WIDTH), vertical: ticksOf(SLIDE_HEIGHT) };

let drag: MarginDrag | null = null;

function startOf(orientation: Orientation): 'left' | 'top' {
  return orientation === 'horizontal' ? 'left' : 'top';
}

/** Style of something that starts at `from` and is `size` long on the axis of the ruler. */
function span(orientation: Orientation, from: number, size: number): Record<string, string> {
  return orientation === 'horizontal' ? { left: `${String(from)}cqw`, width: `${String(size)}cqw` } : { top: `${String(from)}cqw`, height: `${String(size)}cqw` };
}

function selectionSpan(orientation: Orientation): Record<string, string> {
  const { selection } = props;
  if (selection === null) return {};
  return orientation === 'horizontal' ? span(orientation, selection.x, selection.w) : span(orientation, selection.y, selection.h);
}

function onPointerDown(event: PointerEvent, side: MarginSide): void {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  drag = new MarginDrag(side, event, props.slideWidth());
  if (event.currentTarget instanceof Element) event.currentTarget.setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent): void {
  drag?.update(event);
}

function onPointerUp(event: PointerEvent): void {
  if (event.currentTarget instanceof Element && event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
  drag = null;
}

function reset(side: MarginSide): void {
  canvasMargins[side] = defaultMargin(side);
}
</script>

<template>
  <div v-for="ruler in RULERS" :key="ruler.orientation" class="ruler" :class="ruler.orientation" aria-hidden="true" :data-testid="`ruler-${ruler.orientation}`">
    <span class="shade" :style="span(ruler.orientation, 0, canvasMargins[ruler.sides[0]])"></span>
    <span class="shade" :style="span(ruler.orientation, ruler.length - canvasMargins[ruler.sides[1]], canvasMargins[ruler.sides[1]])"></span>
    <span v-if="selection" class="selection" :style="selectionSpan(ruler.orientation)"></span>
    <span v-for="tick in TICKS[ruler.orientation]" :key="tick" class="tick" :class="{ major: tick % LABEL_STEP === 0 }" :style="{ [startOf(ruler.orientation)]: `${String(tick)}cqw` }">
      <b v-if="tick % LABEL_STEP === 0">{{ tick }}</b>
    </span>
    <span
      v-for="side in ruler.sides"
      :key="side"
      class="marker"
      :style="{ [startOf(ruler.orientation)]: `${String(marginLine(side))}cqw` }"
      :data-side="side"
      :data-testid="`marker-${side}`"
      :title="t(`editor.margin.${side}`)"
      @pointerdown="onPointerDown($event, side)"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @dblclick="reset(side)"
    ></span>
  </div>
</template>

<style scoped>
/* Rulers sit outside the slide, in the padding of the canvas. The units of the ticks are the same cqw as the slide. */
.ruler { position: absolute; z-index: 3; background: var(--s-panel); box-shadow: 0 0 0 1px var(--s-border); border-radius: 2px; color: var(--s-text-2); font-size: 9px; line-height: 10px; user-select: none; pointer-events: none; }
.ruler.horizontal { left: 0; right: 0; top: -22px; height: 16px; }
.ruler.vertical { top: 0; bottom: 0; left: -22px; width: 16px; }
.shade { position: absolute; background: rgba(125, 137, 152, 0.22); }
.horizontal .shade, .horizontal .selection { top: 0; bottom: 0; }
.vertical .shade, .vertical .selection { left: 0; right: 0; }
.selection { position: absolute; background: color-mix(in srgb, var(--s-active) 35%, transparent); }
.tick { position: absolute; }
.horizontal .tick { top: 0; bottom: 0; width: 1px; }
.vertical .tick { left: 0; right: 0; height: 1px; }
.tick::before { content: ''; position: absolute; background: var(--s-text-2); opacity: 0.7; }
.horizontal .tick::before { bottom: 0; width: 1px; height: 4px; }
.horizontal .tick.major::before { height: 8px; }
.vertical .tick::before { right: 0; height: 1px; width: 4px; }
.vertical .tick.major::before { width: 8px; }
.tick b { position: absolute; font-weight: 400; }
.horizontal .tick b { left: 3px; top: 0; }
.vertical .tick b { left: 1px; top: 2px; }
/* A marker is a small triangle that points at its margin; the area around it makes it easy to grab. */
.marker { position: absolute; width: 0; height: 0; pointer-events: auto; touch-action: none; }
.marker::after { content: ''; position: absolute; inset: -5px; }
.horizontal .marker { bottom: 1px; margin-left: -5px; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 7px solid var(--s-active); cursor: col-resize; }
.vertical .marker { right: 1px; margin-top: -5px; border-top: 5px solid transparent; border-bottom: 5px solid transparent; border-left: 7px solid var(--s-active); cursor: row-resize; }
</style>
