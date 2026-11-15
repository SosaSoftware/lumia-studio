<script setup lang="ts">
import { computed } from 'vue';
import { str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import MediaPlaceholder from './MediaPlaceholder.vue';
import { useMotion } from './motion.ts';

const props = defineProps<CatalogComponentProps>();
const { ambient } = useMotion(props);
const emoji = computed(() => str(props.data.emoji).trim());
const fit = computed(() => (str(props.data.fit, 'contain') === 'cover' ? 'cover' : 'contain'));
const effect = computed(() => (ambient.value ? str(props.data.effect, 'float') : 'none'));

const SECONDS: Readonly<Record<string, number>> = { slow: 5, normal: 3, fast: 1.4 };
const duration = computed(() => `${String(SECONDS[str(props.data.speed, 'normal')] ?? 3)}s`);
</script>

<template>
  <div class="el-animation" data-testid="animation">
    <div class="mover" :data-effect="effect" :data-frame="str(data.frame, 'none')" :style="{ animationDuration: duration }">
      <img v-if="media" :src="media.url" :alt="str(data.alt)" :style="{ objectFit: fit }" draggable="false" />
      <span v-else-if="emoji" class="emoji-box" role="img" :aria-label="str(data.alt)"><span class="emoji" aria-hidden="true">{{ emoji }}</span></span>
      <MediaPlaceholder v-else :alt="str(data.alt, 'Animación')" :prompt="str(data.prompt)" tone="illustration" />
    </div>
  </div>
</template>

<style scoped>
.el-animation { width: 100%; height: 100%; }
.mover { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
.mover[data-frame='rounded'] { border-radius: 14%; overflow: hidden; }
.mover[data-frame='circle'] { border-radius: 50%; overflow: hidden; }
img { width: 100%; height: 100%; display: block; }
/* Only the emoji box sizes against itself, so the placeholder keeps the slide scale. */
.emoji-box { width: 100%; height: 100%; container-type: size; display: flex; align-items: center; justify-content: center; }
.emoji { font-size: 68cqmin; line-height: 1; filter: drop-shadow(0 4cqmin 5cqmin rgba(22, 22, 22, 0.18)); }
.mover[data-effect='float'] { animation-name: sl-float; }
.mover[data-effect='pulse'] { animation-name: sl-pulse; }
.mover[data-effect='bounce'] { animation-name: sl-bounce; }
.mover[data-effect='wiggle'] { animation-name: sl-wiggle; }
.mover[data-effect='spin'] { animation-name: sl-spin; animation-timing-function: linear; }
</style>
