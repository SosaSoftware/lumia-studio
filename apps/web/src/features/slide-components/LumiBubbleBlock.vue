<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { num, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import LumiOrb from './LumiOrb.vue';
import { prefersReducedMotion, useMotion } from './motion.ts';
import { colorKey, toneVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const { live, ambient } = useMotion(props);
const typing = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

/** In the preview the dots show first and the message replaces them; the editor shows the message at once. */
function play(): void {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  const delay = Math.max(0, num(props.data.delayS, 1.5));
  if (!live.value || props.data.typing === false || delay === 0 || prefersReducedMotion()) {
    typing.value = false;
    return;
  }
  typing.value = true;
  timer = setTimeout(() => {
    typing.value = false;
  }, delay * 1000);
}

watch([live, () => props.data.typing, () => props.data.delayS, () => props.data.message], play, { immediate: true });
onBeforeUnmount(() => {
  if (timer !== null) clearTimeout(timer);
});
const orbColors = computed(() => ({ '--orb-a': `var(--sl-${colorKey(props.data.color, 'primary')})`, '--orb-b': 'var(--sl-accent)' }));
</script>

<template>
  <div class="el-lumi-bubble" :data-side="str(data.side, 'left')" :style="toneVars(data.color, 'primary')" data-testid="lumi-bubble">
    <span v-if="data.showAvatar !== false" class="avatar"><LumiOrb variant="halo" :state="typing ? 'thinking' : 'speaking'" :active="ambient" :style="orbColors" /></span>
    <div class="bubble" role="status" :aria-busy="typing">
      <span class="name">Lumi</span>
      <span v-if="typing" class="typing" aria-label="Lumi está escribiendo"><i></i><i></i><i></i></span>
      <span v-else :key="str(data.message)" class="message" :data-live="live">{{ str(data.message) }}</span>
    </div>
  </div>
</template>

<style scoped>
.el-lumi-bubble { display: flex; align-items: flex-end; gap: 1.2cqw; }
.el-lumi-bubble[data-side='right'] { flex-direction: row-reverse; }
.avatar { width: 6cqw; height: 6cqw; flex: none; }
.bubble { position: relative; min-width: 0; max-width: 100%; display: flex; flex-direction: column; gap: 0.3cqw; padding: 1.2cqw 1.6cqw; background: var(--sl-card); border: 0.15cqw solid color-mix(in srgb, var(--c) 30%, var(--sl-line)); border-radius: 1.8cqw 1.8cqw 1.8cqw 0.4cqw; box-shadow: var(--sl-elev-2); }
[data-side='right'] .bubble { border-radius: 1.8cqw 1.8cqw 0.4cqw 1.8cqw; }
.name { font-size: 1.15cqw; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; background: linear-gradient(90deg, var(--c), var(--sl-accent)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
.message { font-size: 1.7cqw; line-height: 1.45; color: var(--sl-ink); overflow-wrap: anywhere; }
.message[data-live='true'] { animation: sl-rise 0.4s ease-out both; }
.typing { display: inline-flex; align-items: center; gap: 0.5cqw; height: 2.4cqw; }
.typing i { width: 0.9cqw; height: 0.9cqw; border-radius: 50%; background: var(--c); animation: lumi-typing 1.2s ease-in-out infinite; }
.typing i:nth-child(2) { animation-delay: 0.15s; }
.typing i:nth-child(3) { animation-delay: 0.3s; }

@keyframes lumi-typing {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-0.5cqw); opacity: 1; }
}
</style>
