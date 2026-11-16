<script setup lang="ts">
import { computed } from 'vue';
import { num, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useMotion } from './motion.ts';
import { fillVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const { ambient } = useMotion(props);
const animation = computed(() => (ambient.value ? str(props.data.animation, 'float') : 'none'));
const tilt = computed(() => `${String(Math.min(45, Math.max(-45, num(props.data.rotation, 0))))}deg`);
</script>

<template>
  <div class="el-sticker" data-testid="sticker">
    <span class="body" :data-shape="str(data.shape, 'blob')" :data-animation="animation" :style="{ ...fillVars(data.color, data.variant, 'warning'), '--sl-tilt': tilt }" role="img" :aria-label="`Sticker ${str(data.emoji)}`">
      <span class="emoji" aria-hidden="true">{{ str(data.emoji) }}</span>
    </span>
  </div>
</template>

<style scoped>
.el-sticker { width: 100%; height: 100%; container-type: size; display: flex; align-items: center; justify-content: center; }
.body { width: 92cqmin; height: 92cqmin; display: flex; align-items: center; justify-content: center; background: var(--fill); color: var(--fill-fg); transform: rotate(var(--sl-tilt)); box-shadow: 0 5cqmin 12cqmin color-mix(in srgb, var(--c) 35%, transparent), inset 0 -4cqmin 0 rgba(22, 22, 22, 0.08), inset 0 3cqmin 0 rgba(255, 255, 255, 0.28); user-select: none; }
.body[data-shape='blob'] { border-radius: 34% 66% 62% 38% / 38% 36% 64% 62%; }
.body[data-shape='circle'] { border-radius: 50%; }
.body[data-shape='burst'] { box-shadow: none; filter: drop-shadow(0 4cqmin 6cqmin color-mix(in srgb, var(--c) 40%, transparent)); clip-path: polygon(50% 0%, 61% 12%, 75% 7%, 79% 21%, 93% 25%, 88% 39%, 100% 50%, 88% 61%, 93% 75%, 79% 79%, 75% 93%, 61% 88%, 50% 100%, 39% 88%, 25% 93%, 21% 79%, 7% 75%, 12% 61%, 0% 50%, 12% 39%, 7% 25%, 21% 21%, 25% 7%, 39% 12%); }
.body[data-shape='none'] { background: transparent; box-shadow: none; }
.emoji { font-size: 50cqmin; line-height: 1; font-weight: 600; }
.body[data-shape='none'] .emoji { font-size: 78cqmin; filter: drop-shadow(0 4cqmin 5cqmin rgba(22, 22, 22, 0.2)); }
.body[data-animation='float'] { animation: sl-float 3.2s ease-in-out infinite; }
.body[data-animation='wiggle'] { animation: sl-wiggle 1.6s ease-in-out infinite; }
.body[data-animation='pulse'] { animation: sl-pulse 1.8s ease-in-out infinite; }
.body[data-animation='spin'] { animation: sl-spin 8s linear infinite; }
</style>
