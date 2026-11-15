<script setup lang="ts">
import { computed } from 'vue';
import { str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useMotion } from './motion.ts';
import { toneVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const { live, ambient } = useMotion(props);
const level = computed(() => (str(props.data.level, 'h1') === 'h2' ? 2 : 1));
const align = computed(() => str(props.data.align, 'center'));
const effect = computed(() => str(props.data.effect, 'pop'));
const words = computed(() => str(props.data.text).split(/\s+/).filter((word) => word !== ''));
/** The wave loops, so it also plays on the canvas; the other effects are entrances of the preview. */
const playing = computed(() => (effect.value === 'wave' ? ambient.value : live.value));
</script>

<template>
  <div
    class="el-title-animated"
    role="heading"
    :aria-level="level"
    :aria-label="str(data.text)"
    :data-level="level"
    :data-effect="effect"
    :data-playing="playing"
    :data-gradient="data.gradient !== false"
    :data-align="align"
    :style="toneVars(data.color, 'primary')"
    data-testid="title-animated"
  >
    <span class="words" aria-hidden="true">
      <span v-for="(word, index) in words" :key="index" class="word" :style="{ animationDelay: `${index * 0.09}s` }">{{ word }}</span>
    </span>
    <span v-if="data.underline === true" class="underline" aria-hidden="true"></span>
  </div>
</template>

<style scoped>
.el-title-animated { display: flex; flex-direction: column; align-items: flex-start; gap: 0.8cqw; font-size: 3.6cqw; font-weight: 600; line-height: 1.15; letter-spacing: -0.01em; }
.el-title-animated[data-level='1'] { font-size: 5cqw; }
.el-title-animated[data-align='center'] { align-items: center; text-align: center; }
.el-title-animated[data-align='right'] { align-items: flex-end; text-align: right; }
.words { display: block; max-width: 100%; overflow-wrap: anywhere; }
.word { display: inline-block; margin-right: 0.28em; color: var(--c); padding-bottom: 0.08em; }
.word:last-child { margin-right: 0; }
[data-gradient='true'] .word { background: var(--c-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
[data-playing='true'][data-effect='pop'] .word { animation: sl-pop 0.55s var(--sl-ease-bounce) both; }
[data-playing='true'][data-effect='rise'] .word { animation: sl-rise 0.5s ease-out both; }
[data-playing='true'][data-effect='zoom'] .word { animation: sl-zoom 0.5s var(--sl-ease-bounce) both; }
[data-playing='true'][data-effect='wave'] .word { animation: title-wave 2.4s ease-in-out infinite; }
.underline { width: 22%; min-width: 8cqw; height: 0.7cqw; border-radius: 99cqw; background: var(--c-grad); transform-origin: left center; }
[data-align='center'] .underline { transform-origin: center; }
[data-align='right'] .underline { transform-origin: right center; }
[data-playing='true'] .underline { animation: title-underline 0.7s 0.3s ease-out both; }

@keyframes title-wave {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-0.18em); }
}

@keyframes title-underline {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
</style>
