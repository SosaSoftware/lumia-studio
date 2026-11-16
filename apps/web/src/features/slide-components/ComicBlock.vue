<script setup lang="ts">
import { computed } from 'vue';
import { list, rec, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useMotion } from './motion.ts';

const props = defineProps<CatalogComponentProps>();
const { live } = useMotion(props);
const characters = computed(() =>
  list(props.data.characters)
    .slice(0, 3)
    .map((item) => ({ emoji: str(rec(item).emoji, '🧑'), line: str(rec(item).line).trim(), bubble: str(rec(item).bubble, 'speech') })),
);
const caption = computed(() => str(props.data.caption).trim());

/** Background of each scene and the decoration that sits in it. */
const SCENES: Readonly<Record<string, { background: string; props: readonly string[] }>> = {
  sky: { background: 'linear-gradient(180deg, #87CEEB 0%, #E0F6FF 70%, #B8E3A0 70%, #8FCB6E 100%)', props: ['☁️', '☀️'] },
  space: { background: 'radial-gradient(circle at 80% 20%, #3B2A7A 0%, transparent 40%), linear-gradient(180deg, #0A0E27 0%, #1A1A4E 60%, #2D1B69 100%)', props: ['⭐', '🪐', '✨'] },
  ocean: { background: 'linear-gradient(180deg, #7FD4F5 0%, #2E9BD6 55%, #1565A6 100%)', props: ['🐠', '🫧'] },
  forest: { background: 'linear-gradient(180deg, #CDEFD9 0%, #8FD19E 55%, #4E9B5F 100%)', props: ['🌲', '🍄'] },
  classroom: { background: 'linear-gradient(180deg, #FFF4D1 0%, #FFE6A0 62%, #C8915A 62%, #A86F3E 100%)', props: ['📚', '✏️'] },
  city: { background: 'linear-gradient(180deg, #FFB88C 0%, #FF8A65 45%, #5D4E8C 100%)', props: ['🏙️', '🌆'] },
  plain: { background: 'linear-gradient(135deg, #FFFFFF 0%, #F1EFE9 100%)', props: [] },
};
const scene = computed(() => SCENES[str(props.data.scene, 'space')] ?? { background: 'var(--sl-card)', props: [] });
const dark = computed(() => ['space', 'ocean', 'city'].includes(str(props.data.scene, 'space')));
</script>

<template>
  <figure class="el-comic" :data-halftone="data.halftone !== false" :data-live="live" :data-dark="dark" :style="{ background: scene.background, '--count': String(Math.max(1, characters.length)) }" data-testid="comic">
    <span v-for="(item, index) in scene.props" :key="index" class="prop" :style="{ left: `${12 + index * 34}%`, top: `${index % 2 === 0 ? 12 : 22}%` }" aria-hidden="true">{{ item }}</span>
    <figcaption v-if="caption" class="caption">{{ caption }}</figcaption>
    <div class="cast">
      <div v-for="(character, index) in characters" :key="index" class="actor" :style="{ animationDelay: `${0.2 + index * 0.35}s` }">
        <span v-if="character.line" class="bubble" :data-kind="character.bubble" :data-edge="index === 0 ? 'left' : index === characters.length - 1 && characters.length > 1 ? 'right' : 'center'">{{ character.line }}</span>
        <span class="emoji" aria-hidden="true">{{ character.emoji }}</span>
      </div>
    </div>
  </figure>
</template>

<style scoped>
.el-comic { position: relative; width: 100%; height: 100%; margin: 0; box-sizing: border-box; overflow: hidden; border: 0.45cqw solid #1A1A2E; border-radius: 1cqw; box-shadow: 0.6cqw 0.6cqw 0 #1A1A2E; }
.el-comic[data-halftone='true']::before { content: ''; position: absolute; inset: 0; background-image: radial-gradient(rgba(0, 0, 0, 0.12) 18%, transparent 20%); background-size: 1.2cqw 1.2cqw; pointer-events: none; }
.el-comic[data-dark='true'][data-halftone='true']::before { background-image: radial-gradient(rgba(255, 255, 255, 0.1) 18%, transparent 20%); }
.prop { position: absolute; font-size: 3cqw; opacity: 0.85; }
.caption { position: absolute; left: 1.2cqw; top: 1.2cqw; z-index: 2; max-width: 55%; padding: 0.6cqw 1cqw; background: #FFE66D; border: 0.25cqw solid #1A1A2E; font-size: 1.25cqw; font-weight: 600; font-style: italic; line-height: 1.3; color: #1A1A2E; box-shadow: 0.3cqw 0.3cqw 0 #1A1A2E; }
.cast { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(var(--count), 1fr); align-items: end; padding: 0 2cqw 1.6cqw; }
.actor { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 1.4cqw; min-width: 0; height: 100%; }
.emoji { font-size: 7.5cqw; line-height: 1; filter: drop-shadow(0 0.4cqw 0.3cqw rgba(0, 0, 0, 0.25)); }
.bubble { position: relative; max-width: 100%; box-sizing: border-box; padding: 0.9cqw 1.3cqw; background: #FFFFFF; border: 0.25cqw solid #1A1A2E; border-radius: 1.6cqw; font-size: 1.45cqw; font-weight: 600; line-height: 1.3; color: #1A1A2E; text-align: center; overflow-wrap: anywhere; }
[data-live='true'] .bubble { animation: sl-zoom 0.4s var(--sl-ease-bounce) both; animation-delay: inherit; }
.bubble::after { content: ''; position: absolute; bottom: -1.3cqw; left: 50%; width: 1.6cqw; height: 1.6cqw; background: #FFFFFF; border-right: 0.25cqw solid #1A1A2E; border-bottom: 0.25cqw solid #1A1A2E; transform: translateX(-50%) rotate(45deg) skew(10deg, 10deg); }
.bubble[data-kind='thought'] { border-radius: 3cqw; }
.bubble[data-kind='thought']::after { width: 1cqw; height: 1cqw; bottom: -1.6cqw; border: 0.25cqw solid #1A1A2E; border-radius: 50%; transform: translateX(-50%); }
.bubble[data-kind='shout'] { border-radius: 0.4cqw; font-size: 1.6cqw; text-transform: uppercase; background: #FFFFFF; clip-path: polygon(0% 12%, 8% 0%, 22% 8%, 36% 0%, 50% 8%, 64% 0%, 78% 8%, 92% 0%, 100% 14%, 96% 50%, 100% 86%, 92% 100%, 78% 92%, 64% 100%, 50% 92%, 36% 100%, 22% 92%, 8% 100%, 0% 88%, 4% 50%); border-width: 0; padding: 1.4cqw 1.8cqw; box-shadow: inset 0 0 0 0.3cqw #1A1A2E; }
.bubble[data-kind='shout']::after { display: none; }
</style>
