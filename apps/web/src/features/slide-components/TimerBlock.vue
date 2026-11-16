<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { num, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { clock } from './render-helpers.ts';
import { toneVars } from './tone.ts';

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
  <div class="el-timer" data-testid="timer" :data-done="done" :data-running="running" :data-style="str(data.style, 'ring')" :data-urgent="running && remaining <= 10" :style="toneVars(data.color, 'warning')">
    <span class="ring" role="timer" :aria-label="`${clock(remaining)} restantes`" :style="{ background: `conic-gradient(var(--c) 0 ${percent}%, var(--c-soft) ${percent}% 100%)`, '--progress': `${percent}%` }">
      <span class="face">{{ done ? '0:00' : clock(remaining) }}</span>
    </span>
    <span class="side">
      <span class="kicker">{{ done ? '¡Tiempo!' : 'Temporizador' }}</span>
      <span class="label">{{ label }}</span>
      <span v-if="mode === 'student' && data.showControls !== false" class="controls">
        <button v-if="!running" type="button" class="control primary" :disabled="done" data-testid="timer-start" @click.stop="start">Iniciar</button>
        <button v-else type="button" class="control primary" data-testid="timer-stop" @click.stop="stop">Pausar</button>
        <button type="button" class="control" data-testid="timer-reset" @click.stop="reset">Reiniciar</button>
      </span>
    </span>
  </div>
</template>

<style scoped>
.el-timer { width: 100%; height: 100%; box-sizing: border-box; display: flex; align-items: center; gap: 1.6cqw; padding: 1.2cqw 1.6cqw; background: var(--sl-card); border: 0.15cqw solid color-mix(in srgb, var(--c) 40%, var(--sl-line)); border-radius: 1.6cqw; box-shadow: var(--sl-elev-1); overflow: hidden; }
.ring { width: 6cqw; height: 6cqw; flex: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.face { width: 4.6cqw; height: 4.6cqw; border-radius: 50%; background: var(--sl-card); display: flex; align-items: center; justify-content: center; font-size: 1.5cqw; font-weight: 600; color: var(--c-ink); font-variant-numeric: tabular-nums; }
[data-urgent='true'] .ring { animation: sl-pulse 1s ease-in-out infinite; }
[data-done='true'] .ring { background: var(--sl-danger) !important; }
[data-done='true'] .face { color: var(--sl-danger-ink); animation: sl-shake 0.5s ease-in-out 2; }
.side { min-width: 0; display: flex; flex-direction: column; gap: 0.3cqw; }
.kicker { font-size: 1.2cqw; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--c-ink); }
[data-done='true'] .kicker { color: var(--sl-danger-ink); }
.label { font-size: 1.8cqw; font-weight: 600; line-height: 1.3; color: var(--sl-ink); overflow-wrap: anywhere; }
.controls { display: flex; gap: 0.6cqw; margin-top: 0.4cqw; }
.control { padding: 0.4cqw 1.1cqw; border-radius: 99cqw; border: 0.12cqw solid var(--c); background: transparent; color: var(--sl-ink); font: inherit; font-size: 1.2cqw; font-weight: 600; cursor: pointer; }
.control.primary { background: var(--c); color: var(--c-on); }
.control:disabled { opacity: 0.45; cursor: not-allowed; }
.control:focus-visible { outline: 0.25cqw solid var(--c); outline-offset: 0.2cqw; }
/* Digital: the time is the protagonist and the ring becomes a thin bar under it. */
[data-style='digital'] { flex-direction: column; justify-content: center; gap: 0.8cqw; text-align: center; }
[data-style='digital'] .ring { width: 100%; height: auto; flex-direction: column; gap: 0.8cqw; border-radius: 0; background: none !important; }
[data-style='digital'] .face { width: auto; height: auto; font-size: 5cqw; background: none; letter-spacing: 0.02em; }
[data-style='digital'] .ring::after { content: ''; width: 100%; height: 0.6cqw; border-radius: 99cqw; background: linear-gradient(90deg, var(--c) var(--progress, 100%), var(--c-soft) 0); }
[data-style='digital'] .side { align-items: center; }
</style>
