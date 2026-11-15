<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { list, num, rec, str } from '../../api/decode.ts';
import { burstConfetti } from './confetti.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useQuestionState } from './question-state.ts';
import { letter } from './render-helpers.ts';
import { toneVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const root = ref<HTMLElement | null>(null);
const student = computed(() => props.mode === 'student');
const options = computed(() => list(props.data.options).map((item) => ({ id: str(rec(item).id), text: str(rec(item).text) })));
const correctId = computed(() => str(props.data.correctOptionId));
const total = computed(() => Math.max(1, Math.round(num(props.data.seconds, 20))));
/** One attempt: the first answer, or the end of the time, closes the question. */
const state = useQuestionState(() => props.elementId, () => 1);
const remaining = ref(total.value);
const running = ref(false);
const picked = ref<string | null>(null);
const timedOut = ref(false);
let interval: ReturnType<typeof setInterval> | null = null;

const percent = computed(() => (remaining.value / total.value) * 100);
const urgent = computed(() => running.value && remaining.value <= Math.min(5, Math.ceil(total.value / 4)));
const feedback = computed(() => {
  if (timedOut.value) return { tone: 'timeout', text: str(props.data.feedbackTimeout) };
  if (state.result.value === 'correct') return { tone: 'correct', text: str(props.data.feedbackCorrect) };
  if (state.result.value === 'incorrect') return { tone: 'incorrect', text: str(props.data.feedbackIncorrect) };
  return null;
});

function stop(): void {
  running.value = false;
  if (interval !== null) clearInterval(interval);
  interval = null;
}

function start(): void {
  if (!student.value || running.value || state.locked.value) return;
  running.value = true;
  interval = setInterval(() => {
    remaining.value = Math.max(0, remaining.value - 1);
    if (remaining.value === 0) {
      stop();
      timedOut.value = true;
      state.answer(false);
    }
  }, 1000);
}

function reset(): void {
  stop();
  remaining.value = total.value;
  picked.value = null;
  timedOut.value = false;
  state.reset();
  if (student.value && props.data.autoStart !== false) start();
}

watch(() => [props.data, props.mode] as const, reset, { immediate: true });
onBeforeUnmount(stop);

function pick(id: string): void {
  if (!student.value || state.locked.value || !running.value) return;
  picked.value = id;
  stop();
  const correct = id === correctId.value;
  state.answer(correct);
  if (correct && props.data.confetti !== false) burstConfetti(root.value, 'medium');
}

/** The answer key in the editor; the choice and the right answer once the question closes. */
function look(id: string): 'correct' | 'wrong' | 'dim' | 'idle' {
  if (!student.value) return id === correctId.value ? 'correct' : 'idle';
  if (!state.locked.value) return 'idle';
  if (id === correctId.value) return 'correct';
  return id === picked.value ? 'wrong' : 'dim';
}
</script>

<template>
  <div ref="root" class="el-quiz-timer" :data-live="student" :data-urgent="urgent" :style="toneVars(data.color, 'orange')" data-testid="question-quiz-timer">
    <div class="top">
      <span class="question">{{ str(data.question) }}</span>
      <span class="clock" role="timer" :aria-label="`${remaining} segundos restantes`">
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r="17" class="clock-track" />
          <circle cx="20" cy="20" r="17" class="clock-fill" pathLength="100" :stroke-dasharray="`${percent} 100`" />
        </svg>
        <span class="clock-value">{{ remaining }}</span>
      </span>
    </div>
    <div class="options" role="radiogroup" :aria-label="str(data.question)">
      <button
        v-for="(option, index) in options"
        :key="option.id"
        type="button"
        class="option"
        role="radio"
        :aria-checked="picked === option.id"
        :data-look="look(option.id)"
        :disabled="!student || state.locked.value || !running"
        :tabindex="student ? 0 : -1"
        :data-testid="`question-option-${option.id}`"
        @click.stop="pick(option.id)"
      >
        <span class="letter" aria-hidden="true">{{ letter(index) }}</span>
        <span class="text">{{ option.text }}</span>
        <span v-if="!student && option.id === correctId" class="key">Correcta</span>
      </button>
    </div>
    <div class="foot">
      <button v-if="student && !running && !state.locked.value" type="button" class="start" data-testid="quiz-start" @click.stop="start">Empezar</button>
      <span v-if="student && state.locked.value" class="restart-hint">
        <button type="button" class="restart" @click.stop="reset">Intentar de nuevo</button>
      </span>
      <div v-if="feedback" :key="feedback.tone" class="feedback" role="status" :data-tone="feedback.tone">{{ feedback.text }}</div>
      <span v-else-if="!student" class="hint">Responde antes de {{ total }} s</span>
    </div>
  </div>
</template>

<style scoped>
.el-quiz-timer { position: relative; display: flex; flex-direction: column; gap: 1.4cqw; }
.top { display: flex; align-items: center; gap: 2cqw; }
.question { flex: 1; min-width: 0; font-size: 2.1cqw; font-weight: 600; line-height: 1.3; color: var(--sl-fg); overflow-wrap: anywhere; }
.clock { position: relative; width: 7cqw; height: 7cqw; flex: none; }
.clock svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.clock circle { fill: none; stroke-width: 4; }
.clock-track { stroke: var(--c-soft); }
.clock-fill { stroke: var(--c); stroke-linecap: round; transition: stroke-dasharray 1s linear, stroke 0.3s ease; }
[data-urgent='true'] .clock-fill { stroke: var(--sl-danger); }
[data-urgent='true'] .clock { animation: sl-pulse 1s ease-in-out infinite; }
.clock-value { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 2.4cqw; font-weight: 600; color: var(--c-ink); font-variant-numeric: tabular-nums; }
[data-urgent='true'] .clock-value { color: var(--sl-danger-ink); }
.options { display: grid; grid-template-columns: 1fr 1fr; gap: 1.2cqw; }
.option { display: flex; align-items: center; gap: 1.4cqw; padding: 1.3cqw 1.6cqw; background: var(--sl-card); border: 0.2cqw solid var(--sl-line); border-radius: 1.2cqw; color: var(--sl-ink); font: inherit; font-size: 1.8cqw; text-align: left; box-shadow: var(--sl-elev-1); transition: transform 0.2s var(--sl-ease-bounce), border-color 0.2s ease, opacity 0.2s ease; }
.option:not(:disabled) { cursor: pointer; }
.option:not(:disabled):hover { border-color: var(--c); transform: translateY(-0.15cqw); }
.option:focus-visible { outline: 0.25cqw solid var(--c); outline-offset: 0.2cqw; }
.letter { width: 3.2cqw; height: 3.2cqw; flex: none; border-radius: 0.9cqw; background: var(--c-soft); color: var(--c-ink); display: flex; align-items: center; justify-content: center; font-size: 1.5cqw; font-weight: 600; }
.text { min-width: 0; overflow-wrap: anywhere; }
.key { margin-left: auto; font-size: 1.2cqw; font-weight: 600; color: var(--sl-green-ink); white-space: nowrap; }
.option[data-look='correct'] { border-color: var(--sl-green-ink); background: var(--sl-green-soft); }
.option[data-look='correct'] .letter { background: var(--sl-green-ink); color: var(--sl-white); }
.option[data-look='wrong'] { border-color: var(--sl-red-ink); background: var(--sl-red-soft); }
.option[data-look='wrong'] .letter { background: var(--sl-red-ink); color: var(--sl-white); }
.option[data-look='dim'] { opacity: 0.55; }
[data-live='true'] .option[data-look='correct'] { animation: sl-correct 0.5s var(--sl-ease-bounce); }
[data-live='true'] .option[data-look='wrong'] { animation: sl-shake 0.45s ease; }
.foot { display: flex; align-items: center; gap: 1.4cqw; min-height: 3.6cqw; }
.start, .restart { padding: 0.9cqw 2.2cqw; border: 0; border-radius: 99cqw; background: var(--c-grad); color: var(--c-on); font: inherit; font-size: 1.5cqw; font-weight: 600; cursor: pointer; }
.restart { background: var(--c-soft); color: var(--c-ink); }
.start:focus-visible, .restart:focus-visible { outline: 0.25cqw solid var(--c); outline-offset: 0.2cqw; }
.hint { font-size: 1.3cqw; color: var(--sl-fg-2); }
.feedback { flex: 1; padding: 1cqw 1.4cqw; border-radius: 1.1cqw; font-size: 1.5cqw; line-height: 1.4; animation: sl-rise 0.35s ease-out both; }
.feedback[data-tone='correct'] { background: var(--sl-green-soft); color: var(--sl-green-ink); }
.feedback[data-tone='incorrect'] { background: var(--sl-red-soft); color: var(--sl-red-ink); }
.feedback[data-tone='timeout'] { background: var(--sl-warning-soft); color: var(--sl-warning-ink); }
</style>
