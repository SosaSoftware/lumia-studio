<script setup lang="ts">
import { computed, ref } from 'vue';
import { str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useSlideContext } from './slide-context.ts';

const props = defineProps<CatalogComponentProps>();
const context = useSlideContext();
const open = ref(false);

const hotspots = computed(() => context.elements().filter((element) => element.component === 'hotspot'));
const number = computed(() => Math.max(1, hotspots.value.findIndex((element) => element.id === props.elementId) + 1));
const toLeft = computed(() => (context.elements().find((element) => element.id === props.elementId)?.x ?? 0) > 55);
const showBubble = computed(() => (props.mode === 'student' ? open.value : props.selected));

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') open.value = false;
}
</script>

<template>
  <div class="el-hotspot" data-testid="hotspot">
    <button v-if="mode === 'student'" type="button" class="point live" :aria-expanded="open" :aria-label="str(data.label)" @click.stop="open = !open" @keydown="onKeydown">{{ number }}</button>
    <span v-else class="point" aria-hidden="true">{{ number }}</span>
    <div v-if="showBubble" class="bubble" :data-side="toLeft ? 'left' : 'right'" role="tooltip">
      <span class="title">{{ str(data.label) }}</span>
      <span class="text">{{ str(data.content) }}</span>
    </div>
  </div>
</template>

<style scoped>
.el-hotspot { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.point { height: 100%; max-width: 100%; aspect-ratio: 1; padding: 0; border: 0; border-radius: 50%; background: var(--sl-blue); color: var(--sl-white); display: flex; align-items: center; justify-content: center; font: inherit; font-size: 1.5cqw; font-weight: 700; box-shadow: 0 0 0 0.8cqw var(--sl-blue-halo); }
.point.live { cursor: pointer; }
.point.live:focus-visible { outline: 0.25cqw solid var(--sl-blue); outline-offset: 1cqw; }
@media (prefers-reduced-motion: no-preference) {
  .point.live { animation: halo 2s ease-in-out infinite; }
}
@keyframes halo { 0%, 100% { box-shadow: 0 0 0 0.8cqw var(--sl-blue-halo); } 50% { box-shadow: 0 0 0 1.3cqw var(--sl-blue-halo); } }
.bubble { position: absolute; top: 50%; transform: translateY(-50%); width: 19cqw; box-sizing: border-box; padding: 1.2cqw 1.6cqw; background: var(--sl-card); border-radius: 1cqw; box-shadow: 0 0.6cqw 2cqw var(--sl-shadow-2); display: flex; flex-direction: column; gap: 0.4cqw; z-index: 2; text-align: left; }
.bubble[data-side='right'] { left: calc(100% + 1.6cqw); }
.bubble[data-side='left'] { right: calc(100% + 1.6cqw); }
.title { font-size: 1.7cqw; font-weight: 600; color: var(--sl-ink); }
.text { font-size: 1.5cqw; line-height: 1.4; color: var(--sl-ink-2); }
</style>
