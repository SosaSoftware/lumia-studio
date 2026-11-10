<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { num, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import QuestionFooter from './QuestionFooter.vue';
import { useQuestionState } from './question-state.ts';

const props = defineProps<CatalogComponentProps>();
const answer = computed(() => props.data.answer !== false);
const chosen = ref<boolean | null>(null);
const state = useQuestionState(() => props.elementId, () => num(props.data.attempts, 1));
const student = computed(() => props.mode === 'student');

watch(
  () => props.data,
  () => {
    chosen.value = null;
    state.reset();
  },
);

function choose(value: boolean): void {
  if (!student.value || state.locked.value) return;
  chosen.value = value;
  state.answer(value === answer.value);
}

function look(value: boolean): 'correct' | 'wrong' | 'idle' {
  if (!student.value) return value === answer.value ? 'correct' : 'idle';
  if (chosen.value === value) return value === answer.value ? 'correct' : 'wrong';
  if (state.locked.value && state.result.value === 'incorrect' && value === answer.value) return 'correct';
  return 'idle';
}
</script>

<template>
  <div class="el-tf" data-testid="question-true-false">
    <span class="statement">{{ str(data.statement) }}</span>
    <div class="answers" role="group" :aria-label="str(data.statement)">
      <button type="button" class="answer" :data-look="look(true)" :disabled="!student || state.locked.value" :tabindex="student ? 0 : -1" data-testid="question-tf-true" @click.stop="choose(true)">Verdadero</button>
      <button type="button" class="answer" :data-look="look(false)" :disabled="!student || state.locked.value" :tabindex="student ? 0 : -1" data-testid="question-tf-false" @click.stop="choose(false)">Falso</button>
    </div>
    <QuestionFooter :interactive="student" :design="design" :design-hidden="designHidden" :state="state" :can-check="false" :show-check="false" :feedback-correct="str(data.feedbackCorrect)" :feedback-incorrect="str(data.feedbackIncorrect)" />
  </div>
</template>

<style scoped>
.el-tf { width: 100%; height: 100%; box-sizing: border-box; padding: 1.6cqw 2cqw; display: flex; flex-direction: column; justify-content: center; gap: 1.6cqw; background: var(--sl-card); border: 0.12cqw solid var(--sl-line); border-radius: 1.2cqw; overflow: hidden; }
.statement { font-size: 1.9cqw; font-weight: 600; line-height: 1.35; color: var(--sl-ink); overflow-wrap: anywhere; }
.answers { display: flex; gap: 1.2cqw; }
.answer { flex: 1; padding: 1.1cqw; text-align: center; border-radius: 1cqw; font: inherit; font-size: 1.7cqw; font-weight: 600; background: var(--sl-card); color: var(--sl-ink); border: 0.2cqw solid var(--sl-line); }
.answer:not(:disabled) { cursor: pointer; }
.answer:not(:disabled):hover { border-color: var(--sl-blue); }
.answer:focus-visible { outline: 0.25cqw solid var(--sl-blue); outline-offset: 0.2cqw; }
.answer[data-look='correct'] { background: var(--sl-green-soft); color: var(--sl-green-ink); border-color: var(--sl-green-ink); }
.answer[data-look='wrong'] { background: var(--sl-red-soft); color: var(--sl-red-ink); border-color: var(--sl-red-ink); }
.el-tf :deep(.attempts) { color: var(--sl-ink-3); }
</style>
