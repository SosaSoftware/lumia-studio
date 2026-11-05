<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SlideElement } from '../../api/types.ts';
import CatalogElement from '../slide-components/CatalogElement.vue';
import { DragSession } from './drag-session.ts';
import type { DragOperation } from './drag-session.ts';
import type { Geometry } from './geometry.ts';
import { announce, applyCommand, parseKey } from './keyboard.ts';

const props = defineProps<{
  element: SlideElement;
  selected: boolean;
  editable: boolean;
  /** Width of the slide in pixels, to convert pointer distances. */
  slideWidth: () => number;
  /** Shows the dashed outline and the "Grupo · Componente" tag of the design. */
  showTag: boolean;
  tag: string;
}>();

const emit = defineEmits<{
  select: [id: string];
  geometry: [id: string, geometry: Geometry];
  remove: [id: string];
  announce: [message: string];
}>();

const root = ref<HTMLElement | null>(null);
let session: DragSession | null = null;
let origin = { x: 0, y: 0 };

const geometry = computed<Geometry>(() => ({ x: props.element.x, y: props.element.y, w: props.element.w, h: props.element.h }));

function begin(event: PointerEvent, operation: DragOperation): void {
  if (!props.editable || event.button !== 0) return;
  emit('select', props.element.id);
  root.value?.focus({ preventScroll: true });
  session = new DragSession(operation, geometry.value, props.slideWidth());
  origin = { x: event.clientX, y: event.clientY };
  if (event.currentTarget instanceof Element) event.currentTarget.setPointerCapture(event.pointerId);
}

function onFramePointerDown(event: PointerEvent): void {
  if (!props.editable) {
    emit('select', props.element.id);
    return;
  }
  begin(event, { kind: 'move' });
}

function onPointerMove(event: PointerEvent): void {
  if (session === null) return;
  const next = session.update(event.clientX - origin.x, event.clientY - origin.y);
  if (session.isDrag) emit('geometry', props.element.id, next);
}

function onPointerUp(event: PointerEvent): void {
  if (event.currentTarget instanceof Element && event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
  session = null;
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    root.value?.blur();
    return;
  }
  if (!props.editable) return;
  const command = parseKey(event.key, event.shiftKey);
  if (command === null) return;
  event.preventDefault();
  event.stopPropagation();
  const name = props.element.name;
  if (command.kind === 'delete') {
    emit('announce', announce(command, geometry.value, name));
    emit('remove', props.element.id);
    return;
  }
  const next = applyCommand(geometry.value, command);
  emit('geometry', props.element.id, next);
  emit('announce', announce(command, next, name));
}
</script>

<template>
  <div
    ref="root"
    class="frame"
    role="group"
    tabindex="0"
    :aria-label="`${tag}: ${element.name}`"
    :aria-selected="selected"
    :data-selected="selected"
    :data-tags="showTag"
    :data-editable="editable"
    :data-component="element.component"
    :data-testid="`element-${element.id}`"
    :style="{
      left: `${element.x}cqw`,
      top: `${element.y}cqw`,
      width: `${element.w}cqw`,
      height: `${element.h}cqw`,
      zIndex: selected ? 1000 : element.z,
      cursor: editable ? (selected ? 'move' : 'pointer') : 'default',
    }"
    @pointerdown.stop="onFramePointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @focus="emit('select', element.id)"
    @keydown="onKeydown"
  >
    <div class="content"><CatalogElement :element="element" mode="edit" :selected="selected" /></div>
    <span v-if="showTag" class="tag" aria-hidden="true">{{ tag }}</span>
  </div>
</template>

<style scoped>
.frame { position: absolute; box-sizing: border-box; outline-offset: 0.5cqw; touch-action: none; user-select: none; }
.frame[data-tags='true'] { outline: 0.15cqw dashed var(--s-active-ring); }
.frame[data-editable='true']:hover { outline: 0.15cqw solid var(--s-active-ring); }
.frame[data-selected='true'], .frame:focus-visible { outline: 0.3cqw solid var(--s-active); }
.content { width: 100%; height: 100%; pointer-events: none; }
.tag { position: absolute; left: -0.5cqw; top: -0.5cqw; transform: translateY(-100%); z-index: 4; padding: 1px 6px; border-radius: 4px 4px 4px 0; background: var(--s-active); color: var(--s-on-active); font-size: 10px; font-weight: 500; line-height: 14px; white-space: nowrap; pointer-events: none; }
</style>
