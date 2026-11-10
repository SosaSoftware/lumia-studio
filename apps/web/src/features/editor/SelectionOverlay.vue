<script setup lang="ts">
import { computed } from 'vue';
import type { SlideElement } from '../../api/types.ts';
import { NO_GUIDES } from './alignment.ts';
import type { Alignment, Guides } from './alignment.ts';
import { DragSession } from './drag-session.ts';
import { RESIZE_HANDLES } from './geometry.ts';
import type { Geometry, ResizeHandle } from './geometry.ts';

/**
 * Outline and the eight resize handles of the selected element. They live outside the clipped slide surface,
 * so an element that touches the edge of the slide can still be resized.
 */
const props = defineProps<{
  element: SlideElement;
  /** Height of the element as it is drawn, in `cqw`: the one of its content when it fits its content. */
  height: number;
  /** The height of the element is the height of its content, so only its width can be resized. */
  fitsContent: boolean;
  slideWidth: () => number;
  /** What the element can match while it is resized: the other elements of the slide. */
  alignment: () => Alignment;
}>();
const emit = defineEmits<{
  geometry: [id: string, geometry: Geometry];
  /** Sizes and distances that match while the element is resized; empty when the gesture ends. */
  guides: [guides: Guides];
}>();

const HANDLE_LABELS: Record<ResizeHandle, string> = {
  nw: 'noroeste',
  n: 'norte',
  ne: 'noreste',
  e: 'este',
  se: 'sureste',
  s: 'sur',
  sw: 'suroeste',
  w: 'oeste',
};

let session: DragSession | null = null;
let origin = { x: 0, y: 0 };
const box = computed(() => ({ left: `${String(props.element.x)}cqw`, top: `${String(props.element.y)}cqw`, width: `${String(props.element.w)}cqw`, height: `${String(props.height)}cqw` }));
/** The handles of the sides when the height follows the content; all of them otherwise. */
const handles = computed<readonly ResizeHandle[]>(() => (props.fitsContent ? ['w', 'e'] : RESIZE_HANDLES));

function onPointerDown(event: PointerEvent, handle: ResizeHandle): void {
  if (event.button !== 0) return;
  event.stopPropagation();
  event.preventDefault();
  session = new DragSession({ kind: 'resize', handle }, { x: props.element.x, y: props.element.y, w: props.element.w, h: props.height }, props.slideWidth(), props.alignment());
  origin = { x: event.clientX, y: event.clientY };
  if (event.currentTarget instanceof Element) event.currentTarget.setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent): void {
  if (session === null) return;
  // Holding Alt resizes freely, without pulling the element onto the size or the distance of other elements.
  const next = session.update(event.clientX - origin.x, event.clientY - origin.y, !event.altKey);
  if (session.isDrag) {
    emit('geometry', props.element.id, next);
    emit('guides', session.guides);
  }
}

function onPointerUp(event: PointerEvent): void {
  if (event.currentTarget instanceof Element && event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  session = null;
  emit('guides', NO_GUIDES);
}
</script>

<template>
  <div class="overlay" aria-hidden="true">
    <div class="box" :style="box">
      <!-- mousedown.prevent keeps the keyboard focus on the element while resizing. -->
      <span
        v-for="handle in handles"
        :key="handle"
        class="handle"
        :data-handle="handle"
        :data-testid="`handle-${handle}`"
        :title="`Cambiar el tamaño (${HANDLE_LABELS[handle]})`"
        @mousedown.prevent
        @pointerdown="onPointerDown($event, handle)"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      ></span>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: absolute; inset: 0; pointer-events: none; z-index: 2; }
.box { position: absolute; box-sizing: border-box; }
.handle { position: absolute; width: 8px; height: 8px; box-sizing: border-box; background: var(--s-on-active); border: 1.5px solid var(--s-active); border-radius: 2px; transform: translate(-50%, -50%); pointer-events: auto; touch-action: none; }
/* Each handle is centered on the real edge or corner of the element. */
.handle[data-handle='nw'] { left: 0; top: 0; cursor: nwse-resize; }
.handle[data-handle='n'] { left: 50%; top: 0; cursor: ns-resize; }
.handle[data-handle='ne'] { left: 100%; top: 0; cursor: nesw-resize; }
.handle[data-handle='e'] { left: 100%; top: 50%; cursor: ew-resize; }
.handle[data-handle='se'] { left: 100%; top: 100%; cursor: nwse-resize; }
.handle[data-handle='s'] { left: 50%; top: 100%; cursor: ns-resize; }
.handle[data-handle='sw'] { left: 0; top: 100%; cursor: nesw-resize; }
.handle[data-handle='w'] { left: 0; top: 50%; cursor: ew-resize; }
</style>
