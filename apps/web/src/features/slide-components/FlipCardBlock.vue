<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { fillVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const flipped = ref(false);
const emoji = computed(() => str(props.data.emoji).trim());
const frontLabel = computed(() => (props.data.frontLabel === undefined ? 'Pregunta' : str(props.data.frontLabel).trim()));
const backLabel = computed(() => (props.data.backLabel === undefined ? 'Respuesta' : str(props.data.backLabel).trim()));

watch(
  () => props.data,
  () => {
    flipped.value = false;
  },
);
</script>

<template>
  <component
    :is="mode === 'student' ? 'button' : 'div'"
    :type="mode === 'student' ? 'button' : undefined"
    class="el-flip"
    :data-live="mode === 'student'"
    :data-flipped="flipped"
    :data-axis="str(data.axis, 'horizontal')"
    :aria-pressed="mode === 'student' ? flipped : undefined"
    :aria-label="mode === 'student' ? (flipped ? `Reverso: ${str(data.back)}. Presiona para ver el frente.` : `Frente: ${str(data.front)}. Presiona para voltear la tarjeta.`) : undefined"
    :style="fillVars(data.color, data.variant, 'primary')"
    data-testid="flip-card"
    @click.stop="mode === 'student' && (flipped = !flipped)"
  >
    <span class="inner">
      <span class="face front" :aria-hidden="mode === 'student'">
        <span v-if="frontLabel" class="side">{{ frontLabel }}</span>
        <span v-if="emoji" class="emoji">{{ emoji }}</span>
        <span class="text">{{ str(data.front) }}</span>
        <svg viewBox="0 0 24 24" class="turn" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5" /></svg>
      </span>
      <span v-if="mode === 'student'" class="face back" aria-hidden="true">
        <span v-if="backLabel" class="side">{{ backLabel }}</span>
        <span class="text">{{ str(data.back) }}</span>
        <svg viewBox="0 0 24 24" class="turn"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5" /></svg>
      </span>
    </span>
  </component>
</template>

<style scoped>
.el-flip { position: relative; display: block; width: 100%; height: 100%; padding: 0; border: 0; background: transparent; font: inherit; color: inherit; perspective: 120cqw; text-align: center; }
.el-flip[data-live='true'] { cursor: pointer; }
.el-flip:focus-visible { outline: 0.25cqw solid var(--c); outline-offset: 0.3cqw; border-radius: 1.6cqw; }
.inner { position: relative; display: block; width: 100%; height: 100%; transform-style: preserve-3d; transition: transform 0.6s var(--sl-ease-bounce); }
.el-flip[data-live='true']:hover .inner { transform: rotateY(8deg); }
.el-flip[data-axis='vertical'][data-live='true']:hover .inner { transform: rotateX(-8deg); }
.el-flip[data-flipped='true'] .inner, .el-flip[data-flipped='true']:hover .inner { transform: rotateY(180deg); }
.el-flip[data-axis='vertical'][data-flipped='true'] .inner, .el-flip[data-axis='vertical'][data-flipped='true']:hover .inner { transform: rotateX(180deg); }
.face { position: absolute; inset: 0; box-sizing: border-box; padding: 1.8cqw; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1cqw; border-radius: 1.6cqw; box-shadow: var(--sl-elev-2); backface-visibility: hidden; -webkit-backface-visibility: hidden; overflow: hidden; }
.front { background: var(--sl-card); color: var(--sl-ink); border: 0.15cqw solid var(--sl-line); }
.front .side { color: var(--c-ink); }
.back { background: var(--fill); color: var(--fill-fg); transform: rotateY(180deg); }
[data-axis='vertical'] .back { transform: rotateX(180deg); }
.side { font-size: 1.2cqw; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.85; }
.emoji { font-size: 4cqw; line-height: 1; }
.text { font-size: 2cqw; font-weight: 600; line-height: 1.3; overflow-wrap: anywhere; }
.back .text { font-weight: 500; font-size: 1.8cqw; }
.turn { position: absolute; right: 1.2cqw; bottom: 1.2cqw; width: 2.2cqw; height: 2.2cqw; opacity: 0.6; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
</style>
