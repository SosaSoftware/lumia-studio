<script setup lang="ts">
import { computed } from 'vue';
import type { ThemeColorKey } from '@lumia/packages/catalog';
import { str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useMotion } from './motion.ts';
import { toneVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const { ambient } = useMotion(props);

const BULB = 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z';
interface CalloutTone {
  color: ThemeColorKey;
  kicker: string;
  icon: readonly string[];
}
const KEY_TONE: CalloutTone = { color: 'warning', kicker: 'Idea clave', icon: [BULB] };
const TONES: Readonly<Record<string, CalloutTone>> = {
  key: KEY_TONE,
  tip: { color: 'success', kicker: 'Consejo', icon: ['M12 3l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 16.9 6.4 20l1.3-6.2L3 9.5l6.3-.7z'] },
  info: { color: 'primary', kicker: 'Dato', icon: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M12 11v5M12 8h.01'] },
  warning: { color: 'danger', kicker: 'Atención', icon: ['M12 3 2 21h20zM12 10v5M12 18h.01'] },
};

const tone = computed(() => TONES[str(props.data.tone, 'key')] ?? KEY_TONE);
const kicker = computed(() => str(props.data.title).trim() || tone.value.kicker);
const emoji = computed(() => str(props.data.emoji).trim());
</script>

<template>
  <div class="el-callout" :data-variant="str(data.variant, 'soft')" :data-floating="ambient && data.animated === true" :style="toneVars(tone.color)">
    <span class="badge" aria-hidden="true">
      <span v-if="emoji" class="emoji">{{ emoji }}</span>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon">
        <path v-for="(d, index) in tone.icon" :key="index" :d="d" />
      </svg>
    </span>
    <div class="body">
      <span class="kicker">{{ kicker }}</span>
      <span class="text">{{ str(data.text) }}</span>
    </div>
  </div>
</template>

<style scoped>
.el-callout { width: 100%; height: 100%; box-sizing: border-box; display: flex; align-items: center; gap: 1.6cqw; padding: 1.2cqw 2cqw 1.2cqw 1.6cqw; border-radius: 1.4cqw; overflow: hidden; background: var(--c-soft); border-left: 0.6cqw solid var(--c); }
.badge { width: 4.6cqw; height: 4.6cqw; flex: none; display: flex; align-items: center; justify-content: center; border-radius: 1.2cqw; background: var(--sl-white-80); color: var(--c-ink); }
[data-floating='true'] .badge { animation: sl-float 3s ease-in-out infinite; }
.icon { width: 58%; height: 58%; }
.emoji { font-size: 2.6cqw; line-height: 1; }
.body { min-width: 0; display: flex; flex-direction: column; gap: 0.3cqw; }
.kicker { font-size: 1.3cqw; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--c-ink); }
.text { font-size: 1.8cqw; line-height: 1.4; color: var(--sl-ink); overflow-wrap: anywhere; }
[data-variant='solid'] { background: var(--c-grad); border-left: 0; padding-left: 2cqw; box-shadow: var(--sl-elev-2); }
[data-variant='solid'] .kicker, [data-variant='solid'] .text { color: var(--c-on); }
[data-variant='solid'] .badge { background: var(--sl-white-35); color: var(--c-on); }
[data-variant='outline'] { background: var(--sl-card); border: 0.2cqw solid var(--c); padding-left: 1.8cqw; }
[data-variant='outline'] .badge { background: var(--c-soft); }
</style>
