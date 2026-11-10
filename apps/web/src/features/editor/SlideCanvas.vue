<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import type { Slide, SlideElement } from '../../api/types.ts';
import type { SlideContext } from '../slide-components/slide-context.ts';
import { GRID_SIZE, canvasGrid } from '../../composables/canvas-grid.ts';
import { canvasMargins } from '../../composables/canvas-margins.ts';
import { panels } from '../../composables/panels.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import { t, tn } from '../../i18n/index.ts';
import { componentName } from './catalog-labels.ts';
import type { SlideFooter } from '../slides/slide-style.ts';
import SlideSurface from '../slides/SlideSurface.vue';
import { COMPONENT_MIME, tagGroup } from '../palette/palette.ts';
import StudioIcon from '../../ui/StudioIcon.vue';
import { NO_GUIDES } from './alignment.ts';
import type { Alignment, Guides } from './alignment.ts';
import CanvasGuides from './CanvasGuides.vue';
import CanvasRulers from './CanvasRulers.vue';
import ElementFrame from './ElementFrame.vue';
import GroupOverlay from './GroupOverlay.vue';
import SelectionOverlay from './SelectionOverlay.vue';
import { clampGeometry, pxToCqw } from './geometry.ts';
import type { Geometry } from './geometry.ts';
import { applyCommand, parseKey } from './keyboard.ts';
import { MarqueeSession } from './marquee-session.ts';
import type { PixelRect } from './marquee-session.ts';
import { alignItems, boundsOf, distributeItems, touches, translateItems } from './selection-geometry.ts';
import type { AlignKind, DistributeAxis, GroupContext, Placed, PlacedChange } from './selection-geometry.ts';

const props = defineProps<{
  slide: Slide;
  /** The selected element when there is exactly one; a group has none. */
  selectedElementId: string | null;
  /** Every selected element. */
  selectedElementIds: readonly string[];
  position: number;
  total: number;
  editable: boolean;
  footer: SlideFooter | null;
  /** Shows an arrow on each side to change slide, for when the strip of slides is not in view. */
  navigation: boolean;
}>();

const emit = defineEmits<{
  'select-element': [id: string | null];
  /** The selection rectangle, Select all or the keyboard changed which elements are selected. */
  'select-elements': [ids: string[]];
  /** A press with Shift, Cmd or Ctrl on an element: adds it to the selection or removes it. */
  'toggle-element': [id: string];
  /** A click on a free place of the canvas or of the slide: the properties of the slide are shown. */
  'select-slide': [];
  /** The arrows beside the slide: -1 goes to the previous slide and 1 to the next. */
  step: [direction: -1 | 1];
  geometry: [id: string, geometry: Geometry];
  /** Several elements moved or aligned at once. */
  geometries: [changes: readonly PlacedChange[]];
  'remove-element': [id: string];
  'remove-elements': [ids: string[]];
  'drop-component': [component: string, x: number, y: number];
  /** Height in `cqw` that an element needs for its content, as the browser measured it; `bound` is false when it is only the height of the frame. */
  'fit-height': [id: string, height: number, bound: boolean];
}>();

const workspace = useWorkspace();
const slideEl = ref<HTMLElement | null>(null);
const stageEl = ref<HTMLElement | null>(null);
const width = ref(0);
const message = ref('');
const guides = ref<Guides>(NO_GUIDES);
/** Height each element needs for its content, measured by its frame; it can differ from the stored one. */
const heights = reactive<Record<string, number>>({});
let observer: ResizeObserver | null = null;

const label = computed(() => t('editor.slideLabel', { position: props.position, total: props.total, title: props.slide.title }));
const context: SlideContext = { elements: () => props.slide.elements, media: (id) => workspace.media.get(id), navigator: null };
const tags = computed(() => panels.tags);
const selectedElement = computed(() => (props.editable ? (props.slide.elements.find((element) => element.id === props.selectedElementId) ?? null) : null));

/** Height of an element as it is drawn: the measured one when there is one. */
function heightOf(element: SlideElement): number {
  return heights[element.id] ?? element.h;
}

function fitsContent(component: string): boolean {
  return workspace.catalog.fitsContent(component);
}

function onSize(id: string, height: number, bound: boolean): void {
  heights[id] = height;
  emit('fit-height', id, height, bound);
}

const selectedSet = computed(() => new Set(props.selectedElementIds));
/** The selected elements, in the order of the slide. */
const selectedElements = computed(() => (props.editable ? props.slide.elements.filter((element) => selectedSet.value.has(element.id)) : []));
const isGroup = computed(() => selectedElements.value.length > 1);

function placedOf(element: SlideElement): Placed {
  return { id: element.id, x: element.x, y: element.y, w: element.w, h: heightOf(element) };
}

const EMPTY_BOUNDS: Geometry = { x: 0, y: 0, w: 0, h: 0 };

/** Rectangle that holds every selected element; null unless there are several. */
const groupBounds = computed<Geometry | null>(() => (isGroup.value ? boundsOf(selectedElements.value.map(placedOf)) : null));

/** Where the selection sits, shown as a band on the rulers. */
const selectionGeometry = computed<Geometry | null>(() => {
  if (groupBounds.value !== null) return groupBounds.value;
  const element = selectedElement.value;
  return element === null ? null : placedOf(element);
});

function tagOf(component: string): string {
  const info = workspace.catalog.component(component);
  return info === undefined ? component : `${tagGroup(info.group)} · ${componentName(info)}`;
}

onMounted(() => {
  const element = slideEl.value;
  if (element === null) return;
  width.value = element.getBoundingClientRect().width;
  observer = new ResizeObserver(() => {
    width.value = element.getBoundingClientRect().width;
  });
  observer.observe(element);
});

onBeforeUnmount(() => {
  observer?.disconnect();
});

function slideWidth(): number {
  return slideEl.value?.getBoundingClientRect().width ?? width.value;
}

/** What an element can align with while it moves: the other elements of the slide and the margins. */
function alignmentOf(id: string): Alignment {
  return alignmentWithout(new Set([id]));
}

function alignmentWithout(excluded: ReadonlySet<string>): Alignment {
  const others = props.slide.elements.filter((element) => !excluded.has(element.id)).map((element) => ({ x: element.x, y: element.y, w: element.w, h: heightOf(element) }));
  return { others, margins: { ...canvasMargins } };
}

/** What each member of a selection of several needs to move with the rest. */
const groupContext: GroupContext = {
  bounds: () => boundsOf(selectedElements.value.map(placedOf)) ?? EMPTY_BOUNDS,
  alignment: () => alignmentWithout(selectedSet.value),
};

function groupOf(id: string): GroupContext | null {
  return isGroup.value && selectedSet.value.has(id) ? groupContext : null;
}

/**
 * Moving or aligning places the elements and does not resize them, so every change keeps the stored height: the
 * measured one is read in whole pixels and would slightly change an element that only moved.
 */
function emitPlaced(changes: readonly PlacedChange[]): void {
  emit(
    'geometries',
    changes.map((change) => {
      const element = props.slide.elements.find((candidate) => candidate.id === change.id);
      return element === undefined ? change : { id: change.id, geometry: { ...change.geometry, h: element.h } };
    }),
  );
}

/** The group was dragged to `bounds`: every member moves by the same distance. */
function onGroupGeometry(bounds: Geometry): void {
  const items = selectedElements.value.map(placedOf);
  const current = boundsOf(items);
  if (current === null) return;
  emitPlaced(translateItems(items, bounds.x - current.x, bounds.y - current.y));
}

function onAlign(kind: AlignKind): void {
  emitPlaced(alignItems(selectedElements.value.map(placedOf), kind));
}

function onDistribute(axis: DistributeAxis): void {
  emitPlaced(distributeItems(selectedElements.value.map(placedOf), axis));
}

function removeSelection(): void {
  const ids = selectedElements.value.map((element) => element.id);
  announce(tn('editor.announce.groupDeleted', ids.length));
  emit('remove-elements', ids);
}

// -- Selection rectangle -------------------------------------------------------

/** The rectangle being dragged on a free place of the canvas, relative to the stage; null when there is none. */
const marqueeRect = ref<PixelRect | null>(null);
let marquee: MarqueeSession | null = null;

function onBackgroundPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return;
  if (!props.editable) {
    emit('select-slide');
    return;
  }
  // The stage takes the focus so Select all and the arrows work right after a click on the canvas.
  stageEl.value?.focus({ preventScroll: true });
  marquee = new MarqueeSession({ x: event.clientX, y: event.clientY }, event.shiftKey || event.metaKey || event.ctrlKey, props.selectedElementIds);
  stageEl.value?.setPointerCapture(event.pointerId);
}

function onStagePointerMove(event: PointerEvent): void {
  if (marquee === null) return;
  marquee.update({ x: event.clientX, y: event.clientY });
  if (!marquee.isDrag) return;
  const stage = stageEl.value?.getBoundingClientRect();
  const slide = slideEl.value?.getBoundingClientRect();
  if (stage === undefined || slide === undefined || slide.width <= 0) return;
  const rect = marquee.rect;
  marqueeRect.value = { left: rect.left - stage.left, top: rect.top - stage.top, width: rect.width, height: rect.height };
  const area: Geometry = {
    x: pxToCqw(rect.left - slide.left, slide.width),
    y: pxToCqw(rect.top - slide.top, slide.width),
    w: pxToCqw(rect.width, slide.width),
    h: pxToCqw(rect.height, slide.width),
  };
  const hits = props.slide.elements.filter((element) => touches(area, placedOf(element))).map((element) => element.id);
  emit('select-elements', marquee.additive ? [...new Set([...marquee.base, ...hits])] : hits);
}

function onStagePointerUp(event: PointerEvent): void {
  const finished = marquee;
  marquee = null;
  marqueeRect.value = null;
  if (stageEl.value?.hasPointerCapture(event.pointerId) === true) stageEl.value.releasePointerCapture(event.pointerId);
  if (finished === null) return;
  if (finished.isDrag) return;
  // A click on a free place shows the properties of the slide, unless a modifier key asked to keep the selection.
  if (!finished.additive) emit('select-slide');
}

// Every way of selecting several elements (rectangle, Shift-click, Select all) is announced the same way.
watch(
  () => props.selectedElementIds.length,
  (count) => {
    if (count > 1) announce(tn('editor.announce.selected', count));
  },
);

// A paste, a cut or a deleted element can leave the keyboard focus on nothing, and then Delete and the arrows would
// not reach the selection. When that happens the focus goes to the selected element, or to the canvas for a group.
watch(
  () => props.selectedElementIds,
  async (ids) => {
    await nextTick();
    const stage = stageEl.value;
    if (!props.editable || stage === null || ids.length === 0) return;
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;
    const frame = ids.length === 1 ? stage.querySelector<HTMLElement>(`[data-element-id="${ids[0] ?? ''}"]`) : null;
    (frame ?? stage).focus({ preventScroll: true });
  },
);

/** Keys of the canvas that work on several elements; the frame of a single element handles its own. */
function onStageKeydown(event: KeyboardEvent): void {
  if (!props.editable) return;
  const target = event.target;
  // Inside a field the keys keep their text meaning.
  if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]') !== null) return;
  if (!isGroup.value) return;
  if (event.key === 'Escape') {
    emit('select-slide');
    return;
  }
  const command = parseKey(event.key, event.shiftKey);
  if (command === null || command.kind === 'resize') return;
  event.preventDefault();
  if (command.kind === 'delete') {
    removeSelection();
    return;
  }
  const items = selectedElements.value.map(placedOf);
  const bounds = boundsOf(items);
  if (bounds === null) return;
  const moved = clampGeometry(applyCommand(bounds, command));
  emitPlaced(translateItems(items, moved.x - bounds.x, moved.y - bounds.y));
  announce(tn('editor.announce.groupMoved', items.length));
}

function selectedAlignment(): Alignment {
  return alignmentOf(props.selectedElementId ?? '');
}

function step(direction: -1 | 1): void {
  if ((direction < 0 && props.position <= 1) || (direction > 0 && props.position >= props.total)) return;
  emit('step', direction);
}

function announce(text: string): void {
  // Clearing first makes screen readers repeat identical consecutive messages.
  message.value = '';
  requestAnimationFrame(() => {
    message.value = text;
  });
}

function onDragOver(event: DragEvent): void {
  if (props.editable && event.dataTransfer?.types.includes(COMPONENT_MIME) === true) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }
}

function onDrop(event: DragEvent): void {
  const key = event.dataTransfer?.getData(COMPONENT_MIME) ?? '';
  const rect = slideEl.value?.getBoundingClientRect();
  if (key === '' || rect === undefined || !props.editable) return;
  event.preventDefault();
  emit('drop-component', key, ((event.clientX - rect.left) / rect.width) * 100, ((event.clientY - rect.top) / rect.width) * 100);
}
</script>

<template>
  <div
    ref="stageEl"
    class="stage"
    tabindex="-1"
    data-testid="canvas-stage"
    @pointerdown.self="onBackgroundPointerDown"
    @pointermove="onStagePointerMove"
    @pointerup="onStagePointerUp"
    @pointercancel="onStagePointerUp"
    @keydown="onStageKeydown"
    @selectstart.prevent
  >
    <div class="toolbar">
      <button
        type="button"
        class="prv"
        :aria-pressed="canvasGrid.visible"
        :title="t('editor.gridToggle')"
        :style="{ borderColor: canvasGrid.visible ? 'var(--s-active)' : undefined }"
        data-testid="canvas-grid"
        @click="canvasGrid.visible = !canvasGrid.visible"
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M1 4.5h11M1 8.5h11M4.5 1v11M8.5 1v11" /></svg>{{ t('editor.guides') }}
      </button>
      <button
        type="button"
        class="prv tags"
        :aria-pressed="tags"
        :title="t('editor.tagsToggle')"
        :style="{ borderColor: tags ? 'var(--s-active)' : undefined }"
        data-testid="canvas-tags"
        @click="panels.tags = !panels.tags"
      >
        <StudioIcon name="eye" :size="13" :stroke="2" />{{ t('editor.components') }}
      </button>
      <button
        type="button"
        class="prv feedback"
        :aria-pressed="panels.feedback"
        :title="t('editor.feedbackToggle')"
        :style="{ borderColor: panels.feedback ? 'var(--s-active)' : undefined }"
        data-testid="canvas-feedback"
        @click="panels.feedback = !panels.feedback"
      >
        <StudioIcon name="comments" :size="13" :stroke="2" />{{ t('editor.feedback.title') }}
      </button>
    </div>
    <button v-if="navigation" type="button" class="step prev" :aria-disabled="position <= 1" :aria-label="t('slides.previous')" :title="t('slides.previous')" data-testid="canvas-prev" @click="step(-1)">
      <StudioIcon name="chevron-left" :size="16" :stroke="2" />
    </button>
    <button v-if="navigation" type="button" class="step next" :aria-disabled="position >= total" :aria-label="t('slides.next')" :title="t('slides.next')" data-testid="canvas-next" @click="step(1)">
      <StudioIcon name="chevron-right" :size="16" :stroke="2" />
    </button>
    <div class="slide-box">
      <div
        ref="slideEl"
        class="slide"
        role="group"
        aria-roledescription="diapositiva"
        :aria-label="label"
        :data-testid="`canvas-slide-${slide.id}`"
        @dragover="onDragOver"
        @drop="onDrop"
      >
        <SlideSurface :background="slide.background" :footer="footer" :context="context" @pointerdown.self="onBackgroundPointerDown">
          <!-- Behind the elements, which stack above it. -->
          <div v-if="canvasGrid.visible" class="grid" :style="{ backgroundSize: `${String(GRID_SIZE)}cqw ${String(GRID_SIZE)}cqw` }" aria-hidden="true" data-testid="canvas-grid-lines"></div>
          <ElementFrame
            v-for="element in slide.elements"
            :key="element.id"
            :element="element"
            :selected="selectedSet.has(element.id)"
            :editable="editable"
            :slide-width="slideWidth"
            :alignment="() => alignmentOf(element.id)"
            :show-tag="tags"
            :show-feedback="panels.feedback"
            :tag="tagOf(element.component)"
            :fits-content="fitsContent(element.component)"
            :group="groupOf(element.id)"
            @size="onSize"
            @select="emit('select-element', $event)"
            @toggle="emit('toggle-element', $event)"
            @group-geometry="onGroupGeometry"
            @geometry="(id, geometry) => emit('geometry', id, geometry)"
            @remove="emit('remove-element', $event)"
            @announce="announce"
            @guides="guides = $event"
          />
        </SlideSurface>
      </div>
      <CanvasGuides v-if="editable" :guides="guides" :slide-width="slideWidth" />
      <CanvasRulers v-if="editable" :slide-width="slideWidth" :selection="selectionGeometry" />
      <SelectionOverlay
        v-if="selectedElement"
        :element="selectedElement"
        :height="heightOf(selectedElement)"
        :fits-content="fitsContent(selectedElement.component)"
        :slide-width="slideWidth"
        :alignment="selectedAlignment"
        @geometry="(id, geometry) => emit('geometry', id, geometry)"
        @guides="guides = $event"
      />
      <GroupOverlay v-if="groupBounds" :bounds="groupBounds" :count="selectedElements.length" @align="onAlign" @distribute="onDistribute" @remove="removeSelection" />
    </div>
    <div v-if="marqueeRect" class="marquee" :style="{ left: `${String(marqueeRect.left)}px`, top: `${String(marqueeRect.top)}px`, width: `${String(marqueeRect.width)}px`, height: `${String(marqueeRect.height)}px` }" aria-hidden="true" data-testid="canvas-marquee"></div>
    <div class="sr-only" aria-live="polite" role="status" data-testid="canvas-live">{{ message }}</div>
  </div>
</template>

<style scoped>
/* isolation keeps the z-index of the elements (up to 1000 when selected) inside the canvas, below dialogs and menus. */
/* The padding leaves room for the rulers above and to the left of the slide. */
.stage { position: relative; isolation: isolate; flex: 4 1 0; min-height: 0; container-type: size; display: flex; align-items: center; justify-content: center; padding: 66px 40px 24px; box-sizing: border-box; user-select: none; -webkit-user-select: none; }
/* The ruler starts 44px below the top of the canvas when the slide is limited by its height (timeline open), and the
   toolbar ends at 30px, which leaves a 14px gap between them. */
.stage:focus { outline: none; }
/* The rectangle of the selection: it only draws, so it never takes the pointer from what is under it. */
.marquee { position: absolute; z-index: 6; box-sizing: border-box; border: 1px solid var(--s-active); background: color-mix(in srgb, var(--s-active) 14%, transparent); pointer-events: none; }
.toolbar { position: absolute; top: 6px; right: 12px; display: flex; gap: 8px; }
.toolbar .prv { height: 24px; }
/* Beside the slide, past the ruler on its left; they stay inside the canvas when the slide fills its width. The top
   offset is half of the difference between the top and the bottom padding, which centers them on the slide. */
.step { position: absolute; top: calc(50% + 21px); transform: translateY(-50%); z-index: 4; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; padding: 0; background: var(--s-panel); border: 1px solid var(--s-border); border-radius: 50%; color: var(--s-text-2); cursor: pointer; }
.step:hover { background: var(--s-hover); color: var(--s-text); }
.step[aria-disabled='true'] { opacity: 0.35; cursor: default; }
.step[aria-disabled='true']:hover { background: var(--s-panel); color: var(--s-text-2); }
.step:focus-visible { outline: 2px solid var(--s-active); outline-offset: 2px; }
.step.prev { left: max(6px, calc(50% - min(100cqw, calc(100cqh * 16 / 9)) / 2 - 62px)); }
.step.next { left: min(calc(100% - 36px), calc(50% + min(100cqw, calc(100cqh * 16 / 9)) / 2 + 32px)); }
/* The cell is 1/16 of the width, so the grid has 16 by 9 squares. It sits behind the elements and does not take clicks. */
.grid { position: absolute; inset: 0; z-index: 0; pointer-events: none; background-image: linear-gradient(to right, rgba(110, 120, 140, 0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(110, 120, 140, 0.3) 1px, transparent 1px); }
/* The box is the size container of the overlay, so the handles use the same cqw units as the slide. */
.slide-box { position: relative; width: min(100cqw, calc(100cqh * 16 / 9)); aspect-ratio: 16 / 9; container-type: inline-size; }
.slide { position: absolute; inset: 0; border-radius: 8px; overflow: hidden; box-shadow: var(--s-stage-shadow), 0 0 0 1px var(--s-border); }
</style>
