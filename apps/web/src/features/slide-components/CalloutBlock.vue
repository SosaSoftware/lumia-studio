<script setup lang="ts">
import { computed } from 'vue';
import { str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';

const props = defineProps<CatalogComponentProps>();

const TONES: Record<string, { soft: string; strong: string; ink: string; kicker: string; icon: string[] }> = {
  key: { soft: 'var(--sl-amber-soft)', strong: 'var(--sl-amber)', ink: 'var(--sl-amber-ink)', kicker: 'Idea clave', icon: ['M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z'] },
  tip: { soft: 'var(--sl-green-soft)', strong: 'var(--sl-green)', ink: 'var(--sl-green-ink)', kicker: 'Consejo', icon: ['M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z'] },
  info: { soft: 'var(--sl-blue-soft)', strong: 'var(--sl-blue)', ink: 'var(--sl-blue-ink)', kicker: 'Dato', icon: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M12 11v5M12 8h.01'] },
  warning: { soft: 'var(--sl-red-soft)', strong: 'var(--sl-red)', ink: 'var(--sl-red-ink)', kicker: 'Atención', icon: ['M12 3 2 21h20zM12 10v5M12 18h.01'] },
};

const tone = computed(() => TONES[str(props.data.tone, 'key')] ?? TONES.key);
const kicker = computed(() => str(props.data.title).trim() || (tone.value?.kicker ?? ''));
</script>

<template>
  <div v-if="tone" class="el-callout" :style="{ background: tone.soft, borderLeftColor: tone.strong }">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="icon" :style="{ color: tone.ink }">
      <path v-for="(d, index) in tone.icon" :key="index" :d="d" />
    </svg>
    <div class="body">
      <span class="kicker" :style="{ color: tone.ink }">{{ kicker }}</span>
      <span class="text">{{ str(data.text) }}</span>
    </div>
  </div>
</template>

<style scoped>
.el-callout { width: 100%; height: 100%; box-sizing: border-box; display: flex; align-items: center; gap: 1.6cqw; padding: 1.2cqw 2cqw; border-left: 0.6cqw solid; border-radius: 1cqw; overflow: hidden; }
.icon { width: 3cqw; height: 3cqw; flex: none; }
.body { min-width: 0; display: flex; flex-direction: column; gap: 0.3cqw; }
.kicker { font-size: 1.3cqw; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
.text { font-size: 1.8cqw; line-height: 1.4; color: var(--sl-ink); overflow-wrap: anywhere; }
</style>
