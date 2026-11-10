<script setup lang="ts">
import type { Slide } from '../../api/types.ts';
import CatalogElement from '../slide-components/CatalogElement.vue';
import type { SlideContext } from '../slide-components/slide-context.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import type { SlideFooter } from './slide-style.ts';
import SlideSurface from './SlideSurface.vue';

/** Slide in reduced size: the same catalog components as the canvas, scaled by the container units. */
const props = defineProps<{ slide: Slide; footer: SlideFooter | null }>();
const workspace = useWorkspace();
const context: SlideContext = { elements: () => props.slide.elements, media: (id) => workspace.media.get(id), navigator: null };
</script>

<template>
  <div class="thumb" aria-hidden="true">
    <SlideSurface :background="slide.background" :footer="footer" :context="context">
      <div
        v-for="element in slide.elements"
        :key="element.id"
        class="box"
        :style="{ left: `${element.x}cqw`, top: `${element.y}cqw`, width: `${element.w}cqw`, height: `${element.h}cqw`, zIndex: element.z }"
      >
        <CatalogElement :element="element" mode="edit" />
      </div>
    </SlideSurface>
  </div>
</template>

<style scoped>
.thumb { position: absolute; inset: 0; border-radius: 5px; overflow: hidden; pointer-events: none; }
.box { position: absolute; }
</style>
