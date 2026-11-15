<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { t } from '../../i18n/index.ts';
import { burstConfetti } from './confetti.ts';
import FeedbackField from './FeedbackField.vue';
import type { FeedbackState } from './feedback-state.ts';
import type { QuestionState } from './question-state.ts';

/**
 * Footer of an interactive question: the check button, the attempts left and the message of the answer. It is drawn
 * in every mode so the question takes the same space in the editor, in the thumbnails and in the preview; only the
 * preview (`interactive`) reacts. On the canvas (`design`) a dashed field stands where the message will appear.
 * A correct answer throws confetti over the question when `confetti` is on.
 */
const props = withDefaults(
  defineProps<{
    state: QuestionState;
    canCheck: boolean;
    feedbackCorrect: string;
    feedbackIncorrect: string;
    showCheck?: boolean;
    interactive?: boolean;
    design?: boolean;
    designHidden?: boolean;
    confetti?: boolean;
    /** Text of the check button. */
    checkLabel?: string;
  }>(),
  { showCheck: true, interactive: true, design: false, designHidden: false, confetti: false, checkLabel: 'Comprobar' },
);
const emit = defineEmits<{ check: [] }>();
const root = ref<HTMLElement | null>(null);

const result = computed(() => props.state.result.value);
const feedback = computed(() => (result.value === 'correct' ? props.feedbackCorrect : result.value === 'incorrect' ? props.feedbackIncorrect : ''));
const states = computed<readonly FeedbackState[]>(() => [
  { key: 'success', label: t('editor.feedback.success'), message: props.feedbackCorrect, tone: 'success' },
  { key: 'failure', label: t('editor.feedback.failure'), message: props.feedbackIncorrect, tone: 'failure' },
]);
/** Changes with every answer, so the message pops again even when the result repeats. */
const answerCount = computed(() => props.state.attemptsLeft.value);

watch(result, (value) => {
  if (value === 'correct' && props.interactive && props.confetti) burstConfetti(root.value?.parentElement ?? root.value);
});
</script>

<template>
  <div ref="root" class="q-footer">
    <div class="q-row">
      <button v-if="showCheck" type="button" class="check" :disabled="!interactive || !canCheck || state.locked.value" :tabindex="interactive ? 0 : -1" data-testid="question-check" @click.stop="emit('check')">{{ checkLabel }}</button>
      <span class="attempts" data-testid="question-attempts">
        <svg v-for="n in state.attemptsLeft.value" :key="n" class="heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.5-9.2C1 8.2 3.4 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.6 0 6 3.7 4.5 7.3C19.5 16.4 12 21 12 21z" /></svg>
        Intentos restantes: {{ state.attemptsLeft.value }}
      </span>
    </div>
    <FeedbackField v-if="design" :states="states" :concealed="designHidden" />
    <div v-else-if="feedback" :key="`${result}-${answerCount}`" class="feedback" role="status" :data-result="result" data-testid="question-feedback">
      <span class="feedback-icon" aria-hidden="true">
        <svg v-if="result === 'correct'" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg>
        <svg v-else viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </span>
      <span>{{ feedback }}</span>
    </div>
  </div>
</template>

<style scoped>
.q-footer { display: flex; flex-direction: column; gap: 0.8cqw; }
.q-row { display: flex; align-items: center; gap: 1.4cqw; }
.check { padding: 0.9cqw 2.2cqw; border: 0; border-radius: 99cqw; background: var(--c-grad, var(--sl-blue)); color: var(--c-on, var(--sl-white)); font: inherit; font-size: 1.5cqw; font-weight: 600; cursor: pointer; box-shadow: 0 0.4cqw 1cqw color-mix(in srgb, var(--c, var(--sl-blue)) 30%, transparent); transition: transform 0.2s var(--sl-ease-bounce); }
.check:not(:disabled):hover { transform: translateY(-0.15cqw); }
.check:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
.check:focus-visible { outline: 0.25cqw solid var(--c, var(--sl-blue)); outline-offset: 0.2cqw; }
.attempts { display: inline-flex; align-items: center; gap: 0.4cqw; font-size: 1.3cqw; color: var(--sl-fg-2); }
.heart { width: 1.3cqw; height: 1.3cqw; flex: none; fill: var(--sl-danger); }
.feedback { display: flex; align-items: flex-start; gap: 0.9cqw; padding: 1cqw 1.4cqw; border-radius: 1.1cqw; font-size: 1.5cqw; line-height: 1.4; animation: q-feedback-pop 0.4s var(--sl-ease-bounce) both; }
.feedback[data-result='correct'] { background: var(--sl-green-soft); color: var(--sl-green-ink); }
.feedback[data-result='incorrect'] { background: var(--sl-red-soft); color: var(--sl-red-ink); }
.feedback-icon { width: 2cqw; height: 2cqw; flex: none; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: currentColor; }
.feedback-icon svg { width: 62%; height: 62%; fill: none; stroke: var(--sl-white); stroke-width: 3.2; stroke-linecap: round; stroke-linejoin: round; }

@keyframes q-feedback-pop {
  from { opacity: 0; transform: translateY(0.6cqw) scale(0.96); }
  to { opacity: 1; transform: none; }
}
</style>
