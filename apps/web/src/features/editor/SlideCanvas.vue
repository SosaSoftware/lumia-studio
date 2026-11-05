<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Slide } from '../../api/types.ts';
import type { SlideContext } from '../slide-components/slide-context.ts';
import { panels } from '../../composables/panels.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import { hasFooter } from '../slides/slide-style.ts';
import type { SlideFooter } from '../slides/slide-style.ts';
import SlideSurface from '../slides/SlideSurface.vue';
import { COMPONENT_MIME, tagGroup } from '../palette/palette.ts';
import StudioIcon from '../../ui/StudioIcon.vue';
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
let observer: ResizeObserver | null = null;

const label = computed(() => `Diapositiva ${String(props.position)} de ${String(props.total)}: ${props.slide.title}`);
const context: SlideContext = { elements: () => props.slide.elements, media: (id) => workspace.media.get(id), navigator: null };
const tags = computed(() => panels.tags);
const selectedElement = computed(() => (props.editable ? (props.slide.elements.find((element) => element.id === props.selectedElementId) ?? null) : null));

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
          <ElementFrame
            v-for="element in slide.elements"
            :key="element.id"
            :element="element"
            :selected="element.id === selectedElementId"
            :editable="editable"
            :slide-width="slideWidth"
            :show-tag="tags"
            :tag="tagOf(element.component)"
            @select="emit('select-element', $event)"
            @geometry="(id, geometry) => emit('geometry', id, geometry)"
            @remove="emit('remove-element', $event)"
            @announce="announce"
          />
        </SlideSurface>
      </div>
      <SelectionOverlay v-if="selectedElement" :element="selectedElement" :slide-width="slideWidth" @geometry="(id, geometry) => emit('geometry', id, geometry)" />
    </div>
    <div class="sr-only" aria-live="polite" role="status" data-testid="canvas-live">{{ message }}</div>
  </div>
</template>

<style scoped>
/* isolation keeps the z-index of the elements (up to 1000 when selected) inside the canvas, below dialogs and menus. */
.stage { position: relative; isolation: isolate; flex: 4 1 0; min-height: 0; container-type: size; display: flex; align-items: center; justify-content: center; padding: 44px 32px 24px; box-sizing: border-box; }
.tags { position: absolute; top: 10px; right: 12px; height: 26px; }
/* The box is the size container of the overlay, so the handles use the same cqw units as the slide. */
.slide-box { position: relative; width: min(100cqw, calc(100cqh * 16 / 9)); aspect-ratio: 16 / 9; container-type: inline-size; }
.slide { position: absolute; inset: 0; border-radius: 8px; overflow: hidden; box-shadow: var(--s-stage-shadow), 0 0 0 1px var(--s-border); }
</style>
