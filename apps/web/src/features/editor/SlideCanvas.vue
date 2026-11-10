<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Slide } from '../../api/types.ts';
import type { SlideContext } from '../slide-components/slide-context.ts';
import { GRID_SIZE, canvasGrid } from '../../composables/canvas-grid.ts';
import { canvasMargins } from '../../composables/canvas-margins.ts';
import { panels } from '../../composables/panels.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import { hasFooter } from '../slides/slide-style.ts';
import type { SlideFooter } from '../slides/slide-style.ts';
import SlideSurface from '../slides/SlideSurface.vue';
import { COMPONENT_MIME, tagGroup } from '../palette/palette.ts';
import StudioIcon from '../../ui/StudioIcon.vue';
import { NO_GUIDES } from './alignment.ts';
import type { Alignment, Guides } from './alignment.ts';
import CanvasGuides from './CanvasGuides.vue';
import CanvasRulers from './CanvasRulers.vue';
import ElementFrame from './ElementFrame.vue';
import SelectionOverlay from './SelectionOverlay.vue';
import type { Geometry } from './geometry.ts';

const props = defineProps<{
  slide: Slide;
  selectedElementId: string | null;
  position: number;
  total: number;
  editable: boolean;
  footer: SlideFooter | null;
}>();

const emit = defineEmits<{
  'select-element': [id: string | null];
  geometry: [id: string, geometry: Geometry];
  'remove-element': [id: string];
  'drop-component': [component: string, x: number, y: number];
}>();

const workspace = useWorkspace();
const slideEl = ref<HTMLElement | null>(null);
const width = ref(0);
const message = ref('');
const guides = ref<Guides>(NO_GUIDES);
let observer: ResizeObserver | null = null;

const label = computed(() => `Diapositiva ${String(props.position)} de ${String(props.total)}: ${props.slide.title}`);
const context: SlideContext = { elements: () => props.slide.elements, media: (id) => workspace.media.get(id), navigator: null };
const tags = computed(() => panels.tags);
const selectedElement = computed(() => (props.editable ? (props.slide.elements.find((element) => element.id === props.selectedElementId) ?? null) : null));

/** Where the selected element sits, shown as a band on the rulers. */
const selectionGeometry = computed<Geometry | null>(() => {
  const element = selectedElement.value;
  return element === null ? null : { x: element.x, y: element.y, w: element.w, h: element.h };
});

function tagOf(component: string): string {
  const info = workspace.catalog.component(component);
  return info === undefined ? component : `${tagGroup(info.group)} · ${info.name}`;
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
  const others = props.slide.elements.filter((element) => element.id !== id).map((element) => ({ x: element.x, y: element.y, w: element.w, h: element.h }));
  return { others, margins: { ...canvasMargins } };
}

function selectedAlignment(): Alignment {
  return alignmentOf(props.selectedElementId ?? '');
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
  <div class="stage" data-testid="canvas-stage">
    <div class="toolbar">
      <button
        type="button"
        class="prv"
        :aria-pressed="canvasGrid.visible"
        title="Mostrar u ocultar la cuadrícula"
        :style="{ borderColor: canvasGrid.visible ? 'var(--s-active)' : undefined }"
        data-testid="canvas-grid"
        @click="canvasGrid.visible = !canvasGrid.visible"
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M1 4.5h11M1 8.5h11M4.5 1v11M8.5 1v11" /></svg>Guías
      </button>
      <button
        type="button"
        class="prv tags"
        :aria-pressed="tags"
        title="Mostrar u ocultar el nombre de cada componente"
        :style="{ borderColor: tags ? 'var(--s-active)' : undefined }"
        data-testid="canvas-tags"
        @click="panels.tags = !panels.tags"
      >
        <StudioIcon name="eye" :size="13" :stroke="2" />Componentes
      </button>
    </div>
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
        <SlideSurface :background="slide.background" :type="slide.type" :footer="hasFooter(slide.type) ? footer : null" :context="context" @pointerdown.self="emit('select-element', null)">
          <!-- Behind the elements, which stack above it. -->
          <div v-if="canvasGrid.visible" class="grid" :style="{ backgroundSize: `${String(GRID_SIZE)}cqw ${String(GRID_SIZE)}cqw` }" aria-hidden="true" data-testid="canvas-grid-lines"></div>
          <ElementFrame
            v-for="element in slide.elements"
            :key="element.id"
            :element="element"
            :selected="element.id === selectedElementId"
            :editable="editable"
            :slide-width="slideWidth"
            :alignment="() => alignmentOf(element.id)"
            :show-tag="tags"
            :tag="tagOf(element.component)"
            @select="emit('select-element', $event)"
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
        :slide-width="slideWidth"
        :alignment="selectedAlignment"
        @geometry="(id, geometry) => emit('geometry', id, geometry)"
        @guides="guides = $event"
      />
    </div>
    <div class="sr-only" aria-live="polite" role="status" data-testid="canvas-live">{{ message }}</div>
  </div>
</template>

<style scoped>
/* isolation keeps the z-index of the elements (up to 1000 when selected) inside the canvas, below dialogs and menus. */
/* The padding leaves room for the rulers above and to the left of the slide. */
.stage { position: relative; isolation: isolate; flex: 4 1 0; min-height: 0; container-type: size; display: flex; align-items: center; justify-content: center; padding: 56px 40px 24px; box-sizing: border-box; }
.toolbar { position: absolute; top: 10px; right: 12px; display: flex; gap: 8px; }
.toolbar .prv { height: 26px; }
/* The cell is 1/16 of the width, so the grid has 16 by 9 squares. It sits behind the elements and does not take clicks. */
.grid { position: absolute; inset: 0; z-index: 0; pointer-events: none; background-image: linear-gradient(to right, rgba(110, 120, 140, 0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(110, 120, 140, 0.3) 1px, transparent 1px); }
/* The box is the size container of the overlay, so the handles use the same cqw units as the slide. */
.slide-box { position: relative; width: min(100cqw, calc(100cqh * 16 / 9)); aspect-ratio: 16 / 9; container-type: inline-size; }
.slide { position: absolute; inset: 0; border-radius: 8px; overflow: hidden; box-shadow: var(--s-stage-shadow), 0 0 0 1px var(--s-border); }
</style>
