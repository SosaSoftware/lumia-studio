<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../i18n/index.ts';
import FeedbackField from './FeedbackField.vue';
import type { FeedbackState } from './feedback-state.ts';
import type { QuestionState } from './question-state.ts';

/**
 * Footer of an interactive question: the check button, the attempts left and the message of the answer. It is drawn
 * in every mode so the question takes the same space in the editor, in the thumbnails and in the preview; only the
 * preview (`interactive`) reacts. On the canvas (`design`) a dashed field stands where the message will appear.
 */
const props = withDefaults(
  defineProps<{ state: QuestionState; canCheck: boolean; feedbackCorrect: string; feedbackIncorrect: string; showCheck?: boolean; interactive?: boolean; design?: boolean; designHidden?: boolean }>(),
  { showCheck: true, interactive: true, design: false, designHidden: false },
);
const emit = defineEmits<{ check: [] }>();

const result = computed(() => props.state.result.value);
const feedback = computed(() => (result.value === 'correct' ? props.feedbackCorrect : result.value === 'incorrect' ? props.feedbackIncorrect : ''));
const states = computed<readonly FeedbackState[]>(() => [
  { key: 'success', label: t('editor.feedback.success'), message: props.feedbackCorrect, tone: 'success' },
  { key: 'failure', label: t('editor.feedback.failure'), message: props.feedbackIncorrect, tone: 'failure' },
]);
</script>

<template>
  <div class="q-footer">
    <div class="q-row">
      <button v-if="showCheck" type="button" class="check" :disabled="!interactive || !canCheck || state.locked.value" :tabindex="interactive ? 0 : -1" data-testid="question-check" @click.stop="emit('check')">Comprobar</button>
      <span class="attempts" data-testid="question-attempts">Intentos restantes: {{ state.attemptsLeft.value }}</span>
    </div>
    <FeedbackField v-if="design" :states="states" :concealed="designHidden" />
    <div v-else-if="feedback" class="feedback" role="status" :data-result="result" data-testid="question-feedback">{{ feedback }}</div>
  </div>
</template>

<style scoped>
.q-footer { display: flex; flex-direction: column; gap: 0.8cqw; }
.q-row { display: flex; align-items: center; gap: 1.4cqw; }
.check { padding: 0.9cqw 2cqw; border: 0; border-radius: 0.9cqw; background: var(--sl-blue); color: var(--sl-white); font: inherit; font-size: 1.5cqw; font-weight: 600; cursor: pointer; }
.check:disabled { opacity: 0.45; cursor: not-allowed; }
.check:focus-visible { outline: 0.25cqw solid var(--sl-blue); outline-offset: 0.2cqw; }
.attempts { font-size: 1.3cqw; color: var(--sl-fg-2); }
.feedback { padding: 1cqw 1.4cqw; border-radius: 1cqw; font-size: 1.5cqw; line-height: 1.4; }
.feedback[data-result='correct'] { background: var(--sl-green-soft); color: var(--sl-green-ink); }
.feedback[data-result='incorrect'] { background: var(--sl-red-soft); color: var(--sl-red-ink); }
</style>
