<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { clock } from './render-helpers.ts';

const props = defineProps<CatalogComponentProps>();
const BARS = Array.from({ length: 36 }, (_, index) => 30 + Math.round(70 * Math.abs(Math.sin(index * 1.7) * Math.cos(index * 0.6))));

const playing = ref(false);
const current = ref(0);
const duration = ref(0);
let audio: HTMLAudioElement | null = null;

const live = computed(() => props.mode === 'student' && props.media !== null);
const controls = computed(() => props.data.showControls !== false);
const progress = computed(() => (live.value && duration.value > 0 ? current.value / duration.value : 1 / 3));
const time = computed(() => {
  if (props.media === null) return 'Sin audio';
  if (!live.value) return '0:00';
  return duration.value > 0 ? `${clock(current.value)} / ${clock(duration.value)}` : clock(current.value);
});

function ensureAudio(): HTMLAudioElement | null {
  if (props.media === null) return null;
  if (audio === null) {
    audio = new Audio(props.media.url);
    audio.addEventListener('timeupdate', () => {
      current.value = audio?.currentTime ?? 0;
    });
    audio.addEventListener('loadedmetadata', () => {
      duration.value = Number.isFinite(audio?.duration) ? (audio?.duration ?? 0) : 0;
    });
    audio.addEventListener('ended', () => {
      playing.value = false;
    });
  }
  return audio;
}

function toggle(): void {
  const element = ensureAudio();
  if (element === null) return;
  if (playing.value) {
    element.pause();
    playing.value = false;
    return;
  }
  playing.value = true;
  element.play().catch(() => {
    playing.value = false;
  });
}

onMounted(() => {
  if (live.value && !controls.value) toggle();
});

onBeforeUnmount(() => {
  audio?.pause();
  audio = null;
});
</script>

<template>
  <div class="el-audio" data-testid="audio">
    <button v-if="live && controls" type="button" class="play" :aria-label="playing ? 'Pausar' : 'Reproducir'" data-testid="audio-toggle" @click.stop="toggle">
      <svg v-if="playing" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
      <svg v-else viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
    </button>
    <span v-else class="play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></span>
    <div class="middle">
      <span class="title">{{ str(data.title) }}</span>
      <span class="wave" aria-hidden="true">
        <span v-for="(height, index) in BARS" :key="index" class="bar" :style="{ height: `${height}%`, background: index / BARS.length < progress ? 'var(--sl-blue)' : 'var(--sl-line-2)' }"></span>
      </span>
    </div>
    <span class="time">{{ time }}</span>
  </div>
</template>

<style scoped>
.el-audio { width: 100%; height: 100%; box-sizing: border-box; display: flex; align-items: center; gap: 1.6cqw; padding: 1.2cqw 1.8cqw; background: var(--sl-card); border: 0.12cqw solid var(--sl-line); border-radius: 1.2cqw; overflow: hidden; }
.play { width: 4.4cqw; height: 4.4cqw; flex: none; padding: 0; border: 0; border-radius: 50%; background: var(--sl-blue); color: var(--sl-white); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.play svg { width: 48%; height: 48%; fill: currentColor; }
span.play { cursor: default; }
.play:focus-visible { outline: 0.25cqw solid var(--sl-blue); outline-offset: 0.2cqw; }
.middle { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.6cqw; }
.title { font-size: 1.6cqw; font-weight: 600; color: var(--sl-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wave { display: flex; align-items: center; gap: 0.25cqw; height: 3cqw; }
.bar { flex: 1; border-radius: 0.3cqw; }
.time { flex: none; font-size: 1.4cqw; color: var(--sl-ink-3); white-space: nowrap; }
</style>
