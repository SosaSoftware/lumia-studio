<script setup lang="ts">
import { computed } from 'vue';
import type { QuestionState } from './question-state.ts';

const props = withDefaults(
  defineProps<{ state: QuestionState; canCheck: boolean; feedbackCorrect: string; feedbackIncorrect: string; showCheck?: boolean }>(),
  { showCheck: true },
);
const emit = defineEmits<{ check: [] }>();

const result = computed(() => props.state.result.value);
const feedback = computed(() => (result.value === 'correct' ? props.feedbackCorrect : result.value === 'incorrect' ? props.feedbackIncorrect : ''));
</script>

<template>
  <div class="q-footer">
    <div class="q-row">
      <button v-if="showCheck" type="button" class="check" :disabled="!canCheck || state.locked.value" data-testid="question-check" @click.stop="emit('check')">Comprobar</button>
      <span class="attempts" data-testid="question-attempts">Intentos restantes: {{ state.attemptsLeft.value }}</span>
    </div>
    <div v-if="feedback" class="feedback" role="status" :data-result="result" data-testid="question-feedback">{{ feedback }}</div>
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
