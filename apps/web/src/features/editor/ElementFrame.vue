<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { SlideElement } from '../../api/types.ts';
import CatalogElement from '../slide-components/CatalogElement.vue';
import { NO_GUIDES } from './alignment.ts';
import type { Alignment, Guides } from './alignment.ts';
import { DragSession } from './drag-session.ts';
import type { DragOperation } from './drag-session.ts';
import { round2 } from './geometry.ts';
import type { Geometry } from './geometry.ts';
import { announce, applyCommand, parseKey } from './keyboard.ts';
import type { GroupContext } from './selection-geometry.ts';

const props = defineProps<{
  element: SlideElement;
  selected: boolean;
  editable: boolean;
  /** Width of the slide in pixels, to convert pointer distances. */
  slideWidth: () => number;
  /** What the element can align with when it moves: the other elements and the margins of the slide. */
  alignment: () => Alignment;
  /** Shows the dashed outline and the "Grupo · Componente" tag of the design. */
  showTag: boolean;
  /** Draws the feedback field of the component; when false it keeps its space but is not drawn. */
  showFeedback: boolean;
  tag: string;
  /** The height of the component is the height of its content: the frame has no height of its own. */
  fitsContent: boolean;
  /** Set when the element is one of several selected: it then moves with the group instead of alone. */
  group: GroupContext | null;
}>();

const emit = defineEmits<{
  select: [id: string];
  /** A press with Shift, Cmd or Ctrl: adds the element to the selection or removes it. */
  toggle: [id: string];
  geometry: [id: string, geometry: Geometry];
  /** The group the element belongs to moved: the rectangle that holds all of it. */
  'group-geometry': [bounds: Geometry];
  remove: [id: string];
  announce: [message: string];
  /** Lines the element is aligned with while it moves; empty when the gesture ends. */
  guides: [guides: Guides];
  /**
   * Height in `cqw` that the element needs for its content; reported when it changes. `bound` tells whether the
   * content determines that height (it overflows the frame or the frame follows it) or the height is only the one
   * of the frame, which the person is free to change.
   */
  size: [id: string, height: number, bound: boolean];
}>();

const root = ref<HTMLElement | null>(null);
let session: DragSession | null = null;
/** The press that started `session` was on a member of a group, so it moves the group. */
let groupPress = false;
let origin = { x: 0, y: 0 };

/** Height the element needs, in `cqw`; null until it is measured. */
const needed = ref<number | null>(null);
let neededByContent = false;
let resizeObserver: ResizeObserver | null = null;
let mutationObserver: MutationObserver | null = null;
let measureRequest = 0;

/** The height of the frame as it is drawn: the measured one, which can differ from the one stored in the class. */
const geometry = computed<Geometry>(() => ({ x: props.element.x, y: props.element.y, w: props.element.w, h: needed.value ?? props.element.h }));

/**
 * Measures the height the element needs: the frame itself when it fits its content, and otherwise the larger of the
 * frame and its content, which can overflow when the person writes more than fits.
 */
function measure(): void {
  measureRequest = 0;
  const frame = root.value;
  const slide = props.slideWidth();
  if (frame === null || slide <= 0) return;
  const frameHeight = frame.getBoundingClientRect().height;
  const content = frame.querySelector('.content')?.firstElementChild;
  const contentHeight = content instanceof HTMLElement ? content.scrollHeight : 0;
  const height = props.fitsContent || !(content instanceof HTMLElement) ? frameHeight : Math.max(frameHeight, contentHeight);
  // The content height is read in whole pixels, so a difference below one pixel is not an overflow. Without an
  // overflow the measured height is just the one of the frame, which the person may be shrinking right now.
  const bound = props.fitsContent || contentHeight > frameHeight + 1;
  const next = round2((height / slide) * 100);
  if (needed.value === next && neededByContent === bound) return;
  needed.value = next;
  neededByContent = bound;
  emit('size', props.element.id, next, bound);
}

function scheduleMeasure(): void {
  if (measureRequest === 0) measureRequest = requestAnimationFrame(measure);
}

onMounted(() => {
  const frame = root.value;
  if (frame === null) return;
  const content = frame.querySelector('.content');
  resizeObserver = new ResizeObserver(scheduleMeasure);
  resizeObserver.observe(frame);
  if (content?.firstElementChild) resizeObserver.observe(content.firstElementChild);
  if (content !== null) {
    mutationObserver = new MutationObserver(scheduleMeasure);
    mutationObserver.observe(content, { childList: true, subtree: true, characterData: true, attributes: true });
  }
  measure();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  mutationObserver?.disconnect();
  if (measureRequest !== 0) cancelAnimationFrame(measureRequest);
});

watch(() => [props.element.w, props.element.h, props.fitsContent], scheduleMeasure);

function begin(event: PointerEvent, operation: DragOperation): void {
  if (!props.editable || event.button !== 0) return;
  emit('select', props.element.id);
  root.value?.focus({ preventScroll: true });
  session = new DragSession(operation, geometry.value, props.slideWidth(), operation.kind === 'move' ? props.alignment() : undefined);
  origin = { x: event.clientX, y: event.clientY };
  if (event.currentTarget instanceof Element) event.currentTarget.setPointerCapture(event.pointerId);
}

function onFramePointerDown(event: PointerEvent): void {
  if (!props.editable) {
    emit('select', props.element.id);
    return;
  }
  if (event.button !== 0) return;
  if (event.shiftKey || event.metaKey || event.ctrlKey) {
    emit('toggle', props.element.id);
    return;
  }
  const group = props.group;
  if (group !== null) {
    // Pressing a member keeps the group, so it can be dragged; a press that does not move selects only that member.
    groupPress = true;
    root.value?.focus({ preventScroll: true });
    session = new DragSession({ kind: 'move' }, group.bounds(), props.slideWidth(), group.alignment());
    origin = { x: event.clientX, y: event.clientY };
    if (event.currentTarget instanceof Element) event.currentTarget.setPointerCapture(event.pointerId);
    return;
  }
  groupPress = false;
  begin(event, { kind: 'move' });
}

function onPointerMove(event: PointerEvent): void {
  if (session === null) return;
  // Holding Alt moves the element freely, without pulling it onto the alignment lines.
  const next = session.update(event.clientX - origin.x, event.clientY - origin.y, !event.altKey);
  if (session.isDrag) {
    if (groupPress) emit('group-geometry', next);
    else emit('geometry', props.element.id, next);
    emit('guides', session.guides);
  }
}

function onPointerUp(event: PointerEvent): void {
  if (event.currentTarget instanceof Element && event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
  if (groupPress && session !== null && !session.isDrag) emit('select', props.element.id);
  groupPress = false;
  session = null;
  emit('guides', NO_GUIDES);
}

/** Only keyboard focus selects: a press already did, and selecting again would undo a group or a toggle. */
function onFocus(): void {
  if (!props.selected && root.value?.matches(':focus-visible') === true) emit('select', props.element.id);
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    root.value?.blur();
    return;
  }
  // A group is handled by the canvas, which reads the key as it bubbles up.
  if (!props.editable || props.group !== null) return;
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
    :data-element-id="element.id"
    :data-testid="`element-${element.id}`"
    :style="{
      left: `${element.x}cqw`,
      top: `${element.y}cqw`,
      width: `${element.w}cqw`,
      height: fitsContent ? 'auto' : `${element.h}cqw`,
      zIndex: selected ? 1000 : element.z,
      cursor: editable ? (selected ? 'move' : 'pointer') : 'default',
    }"
    @pointerdown.stop="onFramePointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @focus="onFocus"
    @keydown="onKeydown"
  >
    <div class="content"><CatalogElement :element="element" mode="edit" :selected="selected" design :design-hidden="!showFeedback" /></div>
    <span v-if="showTag" class="tag" aria-hidden="true">{{ tag }}</span>
  </div>
</template>

<style scoped>
/* The outline is centered on the real edge of the element, so it matches the margins and the alignment lines. */
/* Safari needs the prefixed property, or the text of the components gets selected when a selection rectangle crosses it. */
.frame { position: absolute; box-sizing: border-box; outline-offset: -0.075cqw; touch-action: none; user-select: none; -webkit-user-select: none; }
.frame[data-tags='true'] { outline: 0.15cqw dashed var(--s-active-ring); }
.frame[data-editable='true']:hover { outline: 0.15cqw solid var(--s-active-ring); }
.frame[data-selected='true'], .frame:focus-visible { outline: 0.3cqw solid var(--s-active); outline-offset: -0.15cqw; }
.content { width: 100%; height: 100%; pointer-events: none; }
.tag { position: absolute; left: -0.5cqw; top: -0.5cqw; transform: translateY(-100%); z-index: 4; padding: 1px 6px; border-radius: 4px 4px 4px 0; background: var(--s-active); color: var(--s-on-active); font-size: 10px; font-weight: 500; line-height: 14px; white-space: nowrap; pointer-events: none; }
</style>
