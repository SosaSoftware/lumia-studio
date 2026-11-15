<script setup lang="ts">
import { computed } from 'vue';
import { str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import LumiOrb from './LumiOrb.vue';
import { useMotion } from './motion.ts';
import { colorKey } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const { ambient } = useMotion(props);
const state = computed(() => str(props.data.state, 'idle'));
const STATUS: Readonly<Record<string, string>> = { idle: 'Lumi está listo', listening: 'Escuchando…', thinking: 'Pensando…', speaking: 'Lumi está hablando' };
const status = computed(() => str(props.data.statusText).trim() || (STATUS[state.value] ?? STATUS.idle));
const colors = computed(() => ({ '--orb-a': `var(--sl-${colorKey(props.data.from, 'primary')})`, '--orb-b': `var(--sl-${colorKey(props.data.to, 'accent')})` }));
</script>

<template>
  <div class="el-lumi-orb" :data-state="state" :style="colors" role="img" :aria-label="`Lumi: ${status}`" data-testid="lumi-orb">
    <span class="stage">
      <span class="square"><LumiOrb :variant="str(data.variant, 'halo')" :state="state" :active="ambient" :style="colors" /></span>
    </span>
    <span v-if="data.showStatus !== false" class="status" aria-hidden="true"><span class="dot"></span>{{ status }}</span>
  </div>
</template>

<style scoped>
.el-lumi-orb { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1cqw; }
/* The stage is a size container so the orb can be the largest square that fits. */
.stage { flex: 1; min-height: 0; width: 100%; container-type: size; display: flex; align-items: center; justify-content: center; }
.square { width: 78cqmin; height: 78cqmin; }
.status { flex: none; display: inline-flex; align-items: center; gap: 0.6cqw; padding: 0.5cqw 1.2cqw; border-radius: 99cqw; background: var(--sl-card); border: 0.12cqw solid var(--sl-line); box-shadow: var(--sl-elev-1); font-size: 1.15cqw; font-weight: 600; color: var(--sl-ink-2); white-space: nowrap; }
.dot { width: 0.8cqw; height: 0.8cqw; border-radius: 50%; background: var(--sl-success); animation: orb-dot 2s ease-in-out infinite; }
[data-state='listening'] .dot { background: var(--sl-danger); }
[data-state='thinking'] .dot { background: var(--sl-warning); }
[data-state='speaking'] .dot { background: var(--orb-b); }

@keyframes orb-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
