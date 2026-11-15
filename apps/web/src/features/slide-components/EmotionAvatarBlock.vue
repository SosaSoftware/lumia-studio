<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useMotion } from './motion.ts';
import { toneVars } from './tone.ts';

interface Emotion {
  key: string;
  face: string;
  name: string;
}

const EMOTIONS: readonly Emotion[] = [
  { key: 'happy', face: '😊', name: 'Feliz' },
  { key: 'excited', face: '🤩', name: 'Emocionado' },
  { key: 'calm', face: '😌', name: 'Tranquilo' },
  { key: 'thinking', face: '🤔', name: 'Pensativo' },
  { key: 'surprised', face: '😮', name: 'Sorprendido' },
  { key: 'sad', face: '😢', name: 'Triste' },
  { key: 'angry', face: '😠', name: 'Enojado' },
];

const props = defineProps<CatalogComponentProps>();
const { ambient } = useMotion(props);
const current = ref(str(props.data.emotion, 'happy'));
const interactive = computed(() => props.data.interactive !== false);
const clickable = computed(() => props.mode === 'student' && interactive.value);

watch(
  () => props.data.emotion,
  (value) => {
    current.value = str(value, 'happy');
  },
);

const emotion = computed(() => EMOTIONS.find((item) => item.key === current.value) ?? { key: 'happy', face: '😊', name: 'Feliz' });
const label = computed(() => str(props.data.label).trim() || emotion.value.name);
</script>

<template>
  <div class="el-emotion" :data-emotion="emotion.key" :data-ambient="ambient && data.animated !== false" :style="toneVars(data.color, 'warning')" data-testid="emotion-avatar">
    <span v-if="interactive && str(data.prompt)" class="prompt">{{ str(data.prompt) }}</span>
    <span :key="emotion.key" class="face" role="img" :aria-label="label">{{ emotion.face }}</span>
    <span class="label">{{ label }}</span>
    <div v-if="interactive" class="choices" role="radiogroup" :aria-label="str(data.prompt) || 'Emociones'">
      <component
        :is="clickable ? 'button' : 'span'"
        v-for="item in EMOTIONS"
        :key="item.key"
        :type="clickable ? 'button' : undefined"
        class="choice"
        :role="clickable ? 'radio' : undefined"
        :aria-checked="clickable ? item.key === emotion.key : undefined"
        :aria-label="clickable ? item.name : undefined"
        :title="item.name"
        :data-active="item.key === emotion.key"
        @click.stop="clickable && (current = item.key)"
      >{{ item.face }}</component>
    </div>
  </div>
</template>

<style scoped>
.el-emotion { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.8cqw; text-align: center; }
.prompt { font-size: 1.6cqw; font-weight: 600; color: var(--sl-fg); }
.face { flex: 1; min-height: 0; max-height: 11cqw; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: radial-gradient(circle, var(--c-soft) 0 55%, transparent 70%); font-size: 7cqw; line-height: 1; animation: sl-zoom 0.4s var(--sl-ease-bounce) both; }
[data-ambient='true'][data-emotion='happy'] .face, [data-ambient='true'][data-emotion='calm'] .face { animation: sl-zoom 0.4s var(--sl-ease-bounce) both, sl-pulse 2.6s 0.4s ease-in-out infinite; }
[data-ambient='true'][data-emotion='excited'] .face { animation: sl-zoom 0.4s var(--sl-ease-bounce) both, sl-bounce 0.9s 0.4s ease-in-out infinite; }
[data-ambient='true'][data-emotion='thinking'] .face, [data-ambient='true'][data-emotion='surprised'] .face { animation: sl-zoom 0.4s var(--sl-ease-bounce) both, sl-wiggle 2.4s 0.4s ease-in-out infinite; }
[data-ambient='true'][data-emotion='angry'] .face { animation: sl-zoom 0.4s var(--sl-ease-bounce) both, sl-shake 0.6s 0.4s ease-in-out infinite; }
[data-ambient='true'][data-emotion='sad'] .face { animation: sl-zoom 0.4s var(--sl-ease-bounce) both, sl-float 4s 0.4s ease-in-out infinite; }
.label { font-size: 1.7cqw; font-weight: 600; color: var(--c-ink); }
.choices { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5cqw; }
.choice { width: 3.6cqw; height: 3.6cqw; padding: 0; display: flex; align-items: center; justify-content: center; border: 0.15cqw solid var(--sl-line); border-radius: 50%; background: var(--sl-card); font-size: 2cqw; line-height: 1; transition: transform 0.2s var(--sl-ease-bounce), border-color 0.2s ease; }
button.choice { cursor: pointer; }
button.choice:hover { transform: scale(1.15); }
button.choice:focus-visible { outline: 0.25cqw solid var(--c); outline-offset: 0.2cqw; }
.choice[data-active='true'] { border-color: var(--c); background: var(--c-soft); transform: scale(1.12); }
</style>
