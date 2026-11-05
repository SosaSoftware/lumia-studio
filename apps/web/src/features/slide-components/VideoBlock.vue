<script setup lang="ts">
import { computed, ref } from 'vue';
import { num, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';

const props = defineProps<CatalogComponentProps>();
const video = ref<HTMLVideoElement | null>(null);
const startAt = computed(() => Math.max(0, num(props.data.startAtS)));
const autoplay = computed(() => props.data.autoplay === true);
const live = computed(() => props.mode === 'student' && props.media !== null);

function onLoaded(): void {
  if (video.value !== null && startAt.value > 0) video.value.currentTime = startAt.value;
}
</script>

<template>
  <div class="el-video" data-testid="video">
    <video
      v-if="live && media"
      ref="video"
      class="player"
      :src="media.url"
      controls
      playsinline
      preload="metadata"
      :autoplay="autoplay"
      :muted="autoplay"
      :aria-label="str(data.title)"
      @loadedmetadata="onLoaded"
      @click.stop
    ></video>
    <template v-else>
      <video v-if="media" class="player still" :src="media.url" preload="metadata" muted aria-hidden="true"></video>
      <div v-else class="poster" aria-hidden="true"></div>
      <div class="center">
        <span class="play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></span>
        <template v-if="!media">
          <span class="title">{{ str(data.title) }}</span>
          <span v-if="str(data.prompt)" class="prompt">{{ str(data.prompt) }}</span>
        </template>
      </div>
      <div class="bar" aria-hidden="true">
        <svg viewBox="0 0 24 24" class="mini"><path d="M8 5v14l11-7z" /></svg>
        <span class="track"><span class="progress"></span></span>
        <span class="time">0:00</span>
      </div>
      <span class="sr-only">Video: {{ str(data.title) }}</span>
    </template>
  </div>
</template>

<style scoped>
.el-video { position: relative; width: 100%; height: 100%; border-radius: 1.2cqw; overflow: hidden; background: var(--sl-video); }
.player { width: 100%; height: 100%; display: block; object-fit: contain; background: var(--sl-video); }
.still { object-fit: cover; }
.poster { position: absolute; inset: 0; background: linear-gradient(160deg, var(--sl-video-2), var(--sl-video)); }
.center { position: absolute; inset: 0 0 4cqw; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1cqw; padding: 0 3cqw; text-align: center; }
.play { width: 8cqw; height: 8cqw; flex: none; border-radius: 50%; background: var(--sl-play-bg); color: var(--sl-blue); display: flex; align-items: center; justify-content: center; }
.play svg { width: 45%; height: 45%; fill: currentColor; }
.title { font-size: 1.6cqw; font-weight: 600; color: var(--sl-white); }
.prompt { max-width: 90%; font-size: 1.2cqw; line-height: 1.4; color: var(--sl-white-80); display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.bar { position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: 1.4cqw; padding: 1.4cqw 1.8cqw; background: linear-gradient(transparent, var(--sl-video-bar)); color: var(--sl-white); }
.mini { width: 2.2cqw; height: 2.2cqw; flex: none; fill: currentColor; }
.track { position: relative; flex: 1; height: 0.6cqw; border-radius: 0.3cqw; background: var(--sl-white-35); }
.progress { position: absolute; left: 0; top: 0; bottom: 0; width: 0; border-radius: 0.3cqw; background: var(--sl-cyan); }
.time { font-size: 1.3cqw; white-space: nowrap; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
