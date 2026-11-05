<script setup lang="ts">
import { ref, watch } from 'vue';
import { str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';

const props = defineProps<CatalogComponentProps>();
const flipped = ref(false);

watch(
  () => props.data,
  () => {
    flipped.value = false;
  },
);
</script>

<template>
  <button
    v-if="mode === 'student'"
    type="button"
    class="el-flip"
    :data-flipped="flipped"
    :aria-pressed="flipped"
    :aria-label="flipped ? `Respuesta: ${str(data.back)}. Presiona para ver la pregunta.` : `Pregunta: ${str(data.front)}. Presiona para voltear la tarjeta.`"
    data-testid="flip-card"
    @click.stop="flipped = !flipped"
  >
    <span class="inner">
      <span class="face front" aria-hidden="true">
        <span class="side">Pregunta</span><span class="text">{{ str(data.front) }}</span>
        <svg viewBox="0 0 24 24" class="turn"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5" /></svg>
      </span>
      <span class="face back" aria-hidden="true">
        <span class="side">Respuesta</span><span class="text">{{ str(data.back) }}</span>
        <svg viewBox="0 0 24 24" class="turn"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5" /></svg>
      </span>
    </span>
  </button>
  <div v-else class="el-flip static">
    <span class="face front">
      <span class="side">Pregunta</span><span class="text">{{ str(data.front) }}</span>
      <svg viewBox="0 0 24 24" class="turn" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5" /></svg>
    </span>
  </div>
</template>

<style scoped>
.el-flip { position: relative; display: block; width: 100%; height: 100%; padding: 0; border: 0; background: transparent; font: inherit; color: inherit; perspective: 120cqw; cursor: pointer; }
.el-flip.static { cursor: default; }
.el-flip:focus-visible { outline: 0.25cqw solid var(--sl-blue); outline-offset: 0.3cqw; border-radius: 1.4cqw; }
.inner { position: relative; display: block; width: 100%; height: 100%; transform-style: preserve-3d; }
.el-flip[data-flipped='true'] .inner { transform: rotateY(180deg); }
@media (prefers-reduced-motion: no-preference) { .inner { transition: transform 0.5s ease; } }
.face { position: absolute; inset: 0; box-sizing: border-box; padding: 1.8cqw; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.2cqw; text-align: center; border-radius: 1.4cqw; box-shadow: 0 0.5cqw 1.6cqw var(--sl-shadow); backface-visibility: hidden; }
.front { background: var(--sl-blue); color: var(--sl-white); }
.back { background: var(--sl-card); color: var(--sl-ink); border: 0.15cqw solid var(--sl-line); transform: rotateY(180deg); }
.side { font-size: 1.2cqw; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.8; }
.text { font-size: 2cqw; font-weight: 600; line-height: 1.3; overflow-wrap: anywhere; }
.turn { position: absolute; right: 1.2cqw; bottom: 1.2cqw; width: 2.2cqw; height: 2.2cqw; opacity: 0.75; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
</style>
