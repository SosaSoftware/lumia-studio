<script setup lang="ts">
import { computed } from 'vue';
import { str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useMotion } from './motion.ts';
import { toneVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const { live, ambient } = useMotion(props);
const name = computed(() => str(props.data.name).trim());
const expression = computed(() => str(props.data.expression, 'none'));
/** Small badge on the avatar that shows the gesture. */
const GESTURES: Readonly<Record<string, string>> = { happy: '😊', thinking: '🤔', excited: '🤩', surprised: '😮', sad: '😢' };
</script>

<template>
  <div class="el-character" :data-side="str(data.side, 'left')" :data-bubble="str(data.bubble, 'speech')" :data-ambient="ambient && data.animated !== false" :data-live="live && data.animated !== false" :style="toneVars(data.color, 'primary')" data-testid="character-guide">
    <div class="figure" aria-hidden="true">
      <span class="avatar">{{ str(data.avatar, '🙂') }}</span>
      <span v-if="GESTURES[expression]" class="gesture">{{ GESTURES[expression] }}</span>
    </div>
    <div class="bubble" role="note" :aria-label="`${name || 'Personaje'} dice: ${str(data.message)}`">
      <span v-if="name" class="name" aria-hidden="true">{{ name }}</span>
      <span class="message" aria-hidden="true">{{ str(data.message) }}</span>
      <span v-if="str(data.bubble, 'speech') === 'thought'" class="thought-dots" aria-hidden="true"><i></i><i></i></span>
    </div>
  </div>
</template>

<style scoped>
.el-character { width: 100%; height: 100%; display: flex; align-items: center; gap: 2.2cqw; }
.el-character[data-side='right'] { flex-direction: row-reverse; }
.figure { position: relative; height: min(100%, 13cqw); aspect-ratio: 1; flex: none; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.5), transparent 60%), var(--c-grad); box-shadow: 0 0 0 0.5cqw var(--c-soft), var(--sl-elev-2); }
[data-ambient='true'] .figure { animation: sl-bounce 2.4s ease-in-out infinite; }
.avatar { font-size: 6.2cqw; line-height: 1; filter: drop-shadow(0 0.3cqw 0.4cqw rgba(0, 0, 0, 0.2)); }
.gesture { position: absolute; right: -0.4cqw; bottom: -0.2cqw; width: 3.6cqw; height: 3.6cqw; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--sl-card); box-shadow: var(--sl-elev-1); font-size: 2.2cqw; }
.bubble { position: relative; flex: 1; min-width: 0; max-height: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 0.4cqw; padding: 1.4cqw 1.8cqw; background: var(--sl-card); border: 0.2cqw solid var(--c-soft); border-radius: 1.8cqw; box-shadow: var(--sl-elev-2); }
[data-live='true'] .bubble { animation: sl-zoom 0.45s 0.2s var(--sl-ease-bounce) both; transform-origin: left center; }
[data-side='right'][data-live='true'] .bubble { transform-origin: right center; }
/* The tail points at the character from the side it stands on. */
.bubble::before { content: ''; position: absolute; top: 50%; left: -1.2cqw; width: 2cqw; height: 2cqw; background: var(--sl-card); border-left: 0.2cqw solid var(--c-soft); border-bottom: 0.2cqw solid var(--c-soft); transform: translateY(-50%) rotate(45deg); }
[data-side='right'] .bubble::before { left: auto; right: -1.2cqw; transform: translateY(-50%) rotate(225deg); }
[data-bubble='thought'] .bubble { border-radius: 3cqw; border-style: dashed; }
[data-bubble='thought'] .bubble::before { display: none; }
.thought-dots { position: absolute; top: 50%; left: -3cqw; display: flex; align-items: center; gap: 0.4cqw; transform: translateY(-50%); }
[data-side='right'] .thought-dots { left: auto; right: -3cqw; flex-direction: row-reverse; }
.thought-dots i { width: 1.2cqw; height: 1.2cqw; border-radius: 50%; background: var(--sl-card); border: 0.2cqw solid var(--c-soft); }
.thought-dots i:first-child { width: 0.7cqw; height: 0.7cqw; }
.name { font-size: 1.3cqw; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--c-ink); }
.message { font-size: 1.8cqw; line-height: 1.4; color: var(--sl-ink); overflow-wrap: anywhere; }
</style>
