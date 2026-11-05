<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { num, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { clock } from './render-helpers.ts';

const props = defineProps<CatalogComponentProps>();
const total = computed(() => Math.max(1, num(props.data.seconds, 60)));
const label = computed(() => str(props.data.label).trim() || 'Cuenta regresiva');
const remaining = ref(total.value);
const running = ref(false);
let interval: ReturnType<typeof setInterval> | null = null;

const percent = computed(() => (remaining.value / total.value) * 100);
const done = computed(() => remaining.value <= 0);

function stop(): void {
  running.value = false;
  if (interval !== null) clearInterval(interval);
  interval = null;
}

function start(): void {
  if (running.value || done.value) return;
  running.value = true;
  interval = setInterval(() => {
    remaining.value = Math.max(0, remaining.value - 1);
    if (remaining.value <= 0) stop();
  }, 1000);
}

function reset(): void {
  stop();
  remaining.value = total.value;
}

watch(total, reset);
watch(
  () => props.mode,
  (mode) => {
    reset();
    if (mode === 'student' && props.data.autoStart === true) start();
  },
  { immediate: true },
);
onUnmounted(stop);
</script>

<template>
  <div class="el-timer" data-testid="timer" :data-done="done">
    <span class="ring" role="timer" :aria-label="`${clock(remaining)} restantes`" :style="{ background: `conic-gradient(var(--sl-amber) 0 ${percent}%, var(--sl-amber-mid) ${percent}% 100%)` }">
      <span class="face">{{ clock(remaining) }}</span>
    </span>
    <span class="side">
      <span class="kicker">{{ done ? '¡Tiempo!' : 'Temporizador' }}</span>
      <span class="label">{{ label }}</span>
      <span v-if="mode === 'student'" class="controls">
        <button v-if="!running" type="button" class="control primary" :disabled="done" data-testid="timer-start" @click.stop="start">Iniciar</button>
        <button v-else type="button" class="control primary" data-testid="timer-stop" @click.stop="stop">Pausar</button>
        <button type="button" class="control" data-testid="timer-reset" @click.stop="reset">Reiniciar</button>
      </span>
    </span>
  </div>
</template>

<style scoped>
.el-timer { width: 100%; height: 100%; box-sizing: border-box; display: flex; align-items: center; gap: 1.6cqw; padding: 1cqw 1.6cqw; background: var(--sl-amber-soft); border: 0.15cqw solid var(--sl-amber); border-radius: 1.2cqw; overflow: hidden; }
.ring { width: 5.6cqw; height: 5.6cqw; flex: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.face { width: 4.2cqw; height: 4.2cqw; border-radius: 50%; background: var(--sl-amber-soft); display: flex; align-items: center; justify-content: center; font-size: 1.4cqw; font-weight: 700; color: var(--sl-amber-ink); font-variant-numeric: tabular-nums; }
.side { min-width: 0; display: flex; flex-direction: column; gap: 0.3cqw; }
.kicker { font-size: 1.2cqw; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--sl-amber-ink); }
.label { font-size: 1.8cqw; font-weight: 600; line-height: 1.3; color: var(--sl-ink); overflow-wrap: anywhere; }
.controls { display: flex; gap: 0.6cqw; margin-top: 0.4cqw; }
.control { padding: 0.4cqw 1.1cqw; border-radius: 99cqw; border: 0.12cqw solid var(--sl-amber); background: transparent; color: var(--sl-ink); font: inherit; font-size: 1.2cqw; font-weight: 600; cursor: pointer; }
.control.primary { background: var(--sl-amber); }
.control:disabled { opacity: 0.45; cursor: not-allowed; }
.control:focus-visible { outline: 0.25cqw solid var(--sl-blue); outline-offset: 0.2cqw; }
</style>
