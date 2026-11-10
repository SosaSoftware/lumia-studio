<script setup lang="ts">
import type { ThemeColorKey } from '@lumia/packages/catalog';
import { provideSlideContext } from '../slide-components/slide-context.ts';
import type { SlideContext } from '../slide-components/slide-context.ts';
import { slideStyle } from './slide-style.ts';
import type { SlideFooter } from './slide-style.ts';

const props = defineProps<{
  background: ThemeColorKey;
  footer?: SlideFooter | null;
  /** Siblings, media and navigation for the components drawn inside. */
  context?: SlideContext;
}>();

if (props.context !== undefined) provideSlideContext(props.context);
</script>

<template>
  <div class="slide-surface" :style="slideStyle(background)">
    <slot />
    <div v-if="footer" class="slide-foot" aria-hidden="true">
      <span>{{ footer.left }}</span><span>{{ footer.right }}</span>
    </div>
  </div>
</template>
