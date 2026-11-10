<script setup lang="ts">
import { DEFAULT_MARGIN, canvasMargins } from '../../composables/canvas-margins.ts';
import type { MarginSide } from '../../composables/canvas-margins.ts';
import type { Guides, Segment } from './alignment.ts';
import { MarginDrag, isSideMargin, marginLine } from './margin-lines.ts';

/**
 * The margins of the slide, which the person can drag, the lines where the element being moved is aligned and the
 * measuring lines of an equal size or an equal distance while one is resized. All of them are editing aids: they are
 * not part of the class and do not appear in the preview.
 */
const props = defineProps<{ guides: Guides; slideWidth: () => number }>();

const SIDES: readonly MarginSide[] = ['top', 'right', 'bottom', 'left'];
const LABELS: Record<MarginSide, string> = { top: 'superior', right: 'derecho', bottom: 'inferior', left: 'izquierdo' };
/** Difference in `cqw` under which a margin counts as aligned with the element. */
const MATCH = 0.06;

let drag: MarginDrag | null = null;

function styleOf(side: MarginSide): Record<string, string> {
  const position = `${String(marginLine(side))}cqw`;
  return isSideMargin(side) ? { left: position } : { top: position };
}

function segmentStyle(segment: Segment): Record<string, string> {
  const length = `${String(segment.to - segment.from)}cqw`;
  const from = `${String(segment.from)}cqw`;
  const at = `${String(segment.at)}cqw`;
  return segment.axis === 'x' ? { left: from, width: length, top: at } : { top: from, height: length, left: at };
}

function isAligned(side: MarginSide): boolean {
  const lines = isSideMargin(side) ? props.guides.vertical : props.guides.horizontal;
  return lines.some((position) => Math.abs(position - marginLine(side)) <= MATCH);
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
  canvasMargins[side] = DEFAULT_MARGIN;
}
</script>

<template>
  <div class="overlay" aria-hidden="true" data-testid="canvas-guides">
    <span v-for="x in guides.vertical" :key="`v${String(x)}`" class="guide vertical" :style="{ left: `${String(x)}cqw` }"></span>
    <span v-for="y in guides.horizontal" :key="`h${String(y)}`" class="guide horizontal" :style="{ top: `${String(y)}cqw` }"></span>
    <span v-for="(segment, index) in guides.segments" :key="`s${String(index)}`" class="segment" :class="segment.axis === 'x' ? 'horizontal' : 'vertical'" :style="segmentStyle(segment)"></span>
    <div
      v-for="side in SIDES"
      :key="side"
      class="margin"
      :class="{ vertical: isSideMargin(side), aligned: isAligned(side) }"
      :style="styleOf(side)"
      :data-side="side"
      :data-testid="`margin-${side}`"
      :title="`Margen ${LABELS[side]}: arrastra para moverlo, doble clic para restablecerlo`"
      @pointerdown="onPointerDown($event, side)"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @dblclick="reset(side)"
    ></div>
  </div>
</template>

<style scoped>
/* Own tokens: the theme already uses --s-guide for the indent lines of the content tree. */
.overlay { --align-line: #e7157b; --margin-line: rgba(125, 137, 152, 0.8); position: absolute; inset: 0; pointer-events: none; z-index: 2; }
.guide { position: absolute; background: var(--align-line); }
.guide.vertical { top: 0; bottom: 0; width: 1px; transform: translateX(-0.5px); }
.guide.horizontal { left: 0; right: 0; height: 1px; transform: translateY(-0.5px); }
/* A measuring line with a cap at each end, for an equal size or an equal distance. */
.segment { position: absolute; background: var(--align-line); }
.segment::before, .segment::after { content: ''; position: absolute; background: var(--align-line); }
.segment.horizontal { height: 1px; transform: translateY(-0.5px); }
.segment.horizontal::before, .segment.horizontal::after { top: -3px; width: 1px; height: 7px; }
.segment.horizontal::before { left: 0; }
.segment.horizontal::after { right: 0; }
.segment.vertical { width: 1px; transform: translateX(-0.5px); }
.segment.vertical::before, .segment.vertical::after { left: -3px; width: 7px; height: 1px; }
.segment.vertical::before { top: 0; }
.segment.vertical::after { bottom: 0; }
/* The strip is wider than the dashed line, so the margin is easy to grab. The line is centered on its position. */
.margin { position: absolute; pointer-events: auto; touch-action: none; }
.margin.vertical { top: 0; bottom: 0; width: 8px; margin-left: -4px; cursor: col-resize; }
.margin:not(.vertical) { left: 0; right: 0; height: 8px; margin-top: -4px; cursor: row-resize; }
.margin::before { content: ''; position: absolute; }
.margin.vertical::before { top: 0; bottom: 0; left: 50%; transform: translateX(-0.5px); border-left: 1px dashed var(--margin-line); }
.margin:not(.vertical)::before { left: 0; right: 0; top: 50%; transform: translateY(-0.5px); border-top: 1px dashed var(--margin-line); }
.margin:hover::before { border-color: var(--s-active); }
.margin.aligned.vertical::before { border-left: 1px solid var(--align-line); }
.margin.aligned:not(.vertical)::before { border-top: 1px solid var(--align-line); }
</style>
