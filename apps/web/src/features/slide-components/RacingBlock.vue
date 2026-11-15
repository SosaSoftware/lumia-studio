<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { list, rec, str } from '../../api/decode.ts';
import { burstConfetti } from './confetti.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useCompletion } from './motion.ts';
import { seededShuffle } from './render-helpers.ts';
import { toneVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const root = ref<HTMLElement | null>(null);
const student = computed(() => props.mode === 'student');
const report = useCompletion(() => props.elementId);
const questions = computed(() =>
  list(props.data.questions).map((item, index) => {
    const correct = str(rec(item).correct);
    const wrong = list(rec(item).wrong).map((answer) => str(answer)).filter((answer) => answer !== '');
    return { question: str(rec(item).question), correct, options: seededShuffle([correct, ...wrong], `${props.elementId}${String(index)}${correct}`) };
  }),
);
const steps = computed(() => Math.max(1, questions.value.length));
/** Seconds the rival takes to cover one leg. */
const RIVAL_SECONDS: Readonly<Record<string, number>> = { slow: 14, normal: 9, fast: 6 };

const player = ref(0);
const rival = ref(0);
const status = ref<'ready' | 'racing' | 'won' | 'lost'>('ready');
const lastWrong = ref<string | null>(null);
let ticker: ReturnType<typeof setInterval> | null = null;

const current = computed(() => questions.value[player.value] ?? null);

function stop(): void {
  if (ticker !== null) clearInterval(ticker);
  ticker = null;
}

function finish(result: 'won' | 'lost'): void {
  stop();
  status.value = result;
  report(true);
  if (result === 'won' && props.data.confetti !== false) burstConfetti(root.value, 'high');
}

function reset(): void {
  stop();
  player.value = 0;
  rival.value = 0;
  status.value = 'ready';
  lastWrong.value = null;
  report(false);
}

function start(): void {
  if (!student.value || status.value === 'racing') return;
  reset();
  status.value = 'racing';
  const seconds = RIVAL_SECONDS[str(props.data.rivalSpeed, 'normal')] ?? 9;
  // The rival moves in small ticks so its car glides instead of jumping a whole leg.
  ticker = setInterval(() => {
    rival.value = Math.min(steps.value, rival.value + 0.1);
    if (rival.value >= steps.value) finish('lost');
  }, (seconds * 1000) / 10);
}

function answer(option: string): void {
  if (status.value !== 'racing' || current.value === null) return;
  if (option === current.value.correct) {
    lastWrong.value = null;
    player.value += 1;
    if (player.value >= steps.value) finish('won');
  } else {
    lastWrong.value = option;
  }
}

watch(() => [props.data, props.mode] as const, reset, { immediate: true });
onBeforeUnmount(stop);

const playerShare = computed(() => (student.value ? player.value / steps.value : 0.62));
const rivalShare = computed(() => (student.value ? rival.value / steps.value : 0.4));
</script>

<template>
  <div ref="root" class="el-racing" :data-status="status" :style="toneVars(data.color, 'primary')" data-testid="racing">
    <div class="track" aria-hidden="true">
      <div v-for="lane in ['player', 'rival']" :key="lane" class="lane" :data-lane="lane">
        <span v-for="mark in steps - 1" :key="mark" class="mark" :style="{ left: `${(mark / steps) * 100}%` }"></span>
        <span class="flag">🏁</span>
        <span class="racer" :style="{ left: `${(lane === 'player' ? playerShare : rivalShare) * 100}%` }">{{ lane === 'player' ? str(data.player, '🚀') : str(data.rival, '🛸') }}</span>
      </div>
    </div>
    <div class="panel">
      <template v-if="status === 'racing' && current">
        <span class="leg">Tramo {{ player + 1 }} de {{ steps }}</span>
        <span class="question">{{ current.question }}</span>
        <div class="options">
          <button v-for="option in current.options" :key="option" type="button" class="option" :data-wrong="lastWrong === option" @click.stop="answer(option)">{{ option }}</button>
        </div>
      </template>
      <template v-else-if="status === 'won' || status === 'lost'">
        <span class="result" :data-result="status" role="status">{{ status === 'won' ? str(data.feedbackCorrect) : str(data.feedbackIncorrect) }}</span>
        <button type="button" class="go" @click.stop="start">Correr otra vez</button>
      </template>
      <template v-else>
        <span class="intro">Responde bien para avanzar antes que {{ str(data.rival, '🛸') }}</span>
        <button v-if="student" type="button" class="go" data-testid="racing-start" @click.stop="start">¡Arrancar!</button>
        <span v-else class="preview">{{ steps }} preguntas · {{ questions[0]?.question }}</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.el-racing { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; gap: 1.4cqw; }
.track { flex: none; display: flex; flex-direction: column; gap: 0.6cqw; padding: 0.8cqw 1cqw; border-radius: 1.4cqw; background: repeating-linear-gradient(90deg, var(--sl-card-alt) 0 2cqw, var(--sl-card) 2cqw 4cqw); border: 0.12cqw solid var(--sl-line); }
.lane { position: relative; height: 4.6cqw; margin-right: 4cqw; border-radius: 99cqw; background: var(--c-soft); }
.lane[data-lane='rival'] { background: var(--sl-muted-soft); }
.mark { position: absolute; top: 20%; bottom: 20%; width: 0; border-left: 0.2cqw dashed rgba(22, 22, 22, 0.15); }
.flag { position: absolute; left: 100%; top: 50%; transform: translate(0.4cqw, -50%); font-size: 2.6cqw; }
.racer { position: absolute; top: 50%; transform: translate(-10%, -50%); font-size: 3.4cqw; line-height: 1; transition: left 0.6s var(--sl-ease-bounce); filter: drop-shadow(0 0.3cqw 0.3cqw rgba(0, 0, 0, 0.2)); }
[data-status='racing'] .racer { animation: racing-bob 0.5s ease-in-out infinite alternate; }
.panel { flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; gap: 1cqw; padding: 1.4cqw 1.8cqw; border-radius: 1.4cqw; background: var(--sl-card); border: 0.12cqw solid var(--sl-line); box-shadow: var(--sl-elev-1); }
.leg { font-size: 1.2cqw; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--c-ink); }
.question { font-size: 1.9cqw; font-weight: 600; line-height: 1.3; color: var(--sl-ink); }
.options { align-self: stretch; display: grid; grid-template-columns: repeat(auto-fit, minmax(14cqw, 1fr)); gap: 0.9cqw; }
.option { padding: 1cqw 1.2cqw; border: 0.2cqw solid var(--sl-line); border-radius: 1cqw; background: var(--sl-card); color: var(--sl-ink); font: inherit; font-size: 1.6cqw; font-weight: 600; cursor: pointer; transition: transform 0.2s var(--sl-ease-bounce), border-color 0.2s ease; }
.option:hover { border-color: var(--c); transform: translateY(-0.15cqw); }
.option:focus-visible { outline: 0.25cqw solid var(--c); outline-offset: 0.2cqw; }
.option[data-wrong='true'] { border-color: var(--sl-danger); background: var(--sl-danger-soft); animation: sl-shake 0.4s ease; }
.intro, .preview { font-size: 1.6cqw; color: var(--sl-ink-2); }
.preview { font-size: 1.3cqw; }
.go { padding: 0.9cqw 2.4cqw; border: 0; border-radius: 99cqw; background: var(--c-grad); color: var(--c-on); font: inherit; font-size: 1.6cqw; font-weight: 600; cursor: pointer; box-shadow: 0 0.4cqw 1cqw color-mix(in srgb, var(--c) 35%, transparent); }
.go:focus-visible { outline: 0.25cqw solid var(--c); outline-offset: 0.2cqw; }
.result { font-size: 2.2cqw; font-weight: 600; animation: sl-zoom 0.4s var(--sl-ease-bounce) both; }
.result[data-result='won'] { color: var(--sl-success-ink); }
.result[data-result='lost'] { color: var(--sl-danger-ink); }

@keyframes racing-bob {
  from { margin-top: -0.15cqw; }
  to { margin-top: 0.15cqw; }
}
</style>
