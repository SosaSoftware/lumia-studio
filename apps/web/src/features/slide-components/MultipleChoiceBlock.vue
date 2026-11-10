<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { list, num, rec, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import QuestionFooter from './QuestionFooter.vue';
import { useQuestionState } from './question-state.ts';
import { letter } from './render-helpers.ts';

const props = defineProps<CatalogComponentProps>();
const options = computed(() => list(props.data.options).map((item) => ({ id: str(rec(item).id), text: str(rec(item).text) })));
const correctId = computed(() => str(props.data.correctOptionId));
const picked = ref<string | null>(null);
const checked = ref<string | null>(null);
const state = useQuestionState(() => props.elementId, () => num(props.data.attempts, 1));
const student = computed(() => props.mode === 'student');

watch(
  () => props.data,
  () => {
    picked.value = null;
    checked.value = null;
    state.reset();
  },
);

function pick(id: string): void {
  if (!student.value || state.locked.value) return;
  picked.value = id;
  checked.value = null;
}

function check(): void {
  if (picked.value === null) return;
  checked.value = picked.value;
  state.answer(picked.value === correctId.value);
}

/** How an option looks: the answer key in the editor; the person's choice and its result in the preview. */
function look(id: string): 'correct' | 'wrong' | 'picked' | 'idle' {
  if (!student.value) return id === correctId.value ? 'correct' : 'idle';
  if (checked.value === id) return id === correctId.value ? 'correct' : 'wrong';
  if (state.locked.value && state.result.value === 'incorrect' && id === correctId.value) return 'correct';
  return picked.value === id ? 'picked' : 'idle';
}
</script>

<template>
  <div class="el-mc" data-testid="question-multiple-choice">
    <span class="question">{{ str(data.question) }}</span>
    <div class="options" role="radiogroup" :aria-label="str(data.question)">
      <button
        v-for="(option, index) in options"
        :key="option.id"
        type="button"
        class="option"
        role="radio"
        :aria-checked="picked === option.id"
        :data-look="look(option.id)"
        :disabled="!student || state.locked.value"
        :tabindex="student ? 0 : -1"
        :data-testid="`question-option-${option.id}`"
        @click.stop="pick(option.id)"
      >
        <span class="letter" aria-hidden="true">{{ letter(index) }}</span>
        <span class="text">{{ option.text }}</span>
        <span v-if="!student && option.id === correctId" class="key">Correcta</span>
      </button>
    </div>
    <QuestionFooter :interactive="student" :design="design" :design-hidden="designHidden" :state="state" :can-check="picked !== null && checked !== picked" :feedback-correct="str(data.feedbackCorrect)" :feedback-incorrect="str(data.feedbackIncorrect)" @check="check" />
  </div>
</template>

<style scoped>
.el-mc { display: flex; flex-direction: column; gap: 1.4cqw; }
.question { font-size: 2.1cqw; font-weight: 600; line-height: 1.3; color: var(--sl-fg); }
.options { display: grid; grid-template-columns: 1fr 1fr; gap: 1.2cqw; }
.option { display: flex; align-items: center; gap: 1.4cqw; padding: 1.3cqw 1.6cqw; background: var(--sl-card); border: 0.2cqw solid var(--sl-line); border-radius: 1.2cqw; color: var(--sl-ink); font: inherit; font-size: 1.8cqw; text-align: left; }
.option:not(:disabled) { cursor: pointer; }
.option:not(:disabled):hover { border-color: var(--sl-blue); }
.option:focus-visible { outline: 0.25cqw solid var(--sl-blue); outline-offset: 0.2cqw; }
.letter { width: 3.2cqw; height: 3.2cqw; flex: none; border-radius: 0.9cqw; background: var(--sl-blue-soft); color: var(--sl-blue); display: flex; align-items: center; justify-content: center; font-size: 1.5cqw; font-weight: 600; }
.text { min-width: 0; overflow-wrap: anywhere; }
.key { margin-left: auto; font-size: 1.2cqw; font-weight: 600; color: var(--sl-green-ink); white-space: nowrap; }
.option[data-look='picked'] { border-color: var(--sl-blue); }
.option[data-look='picked'] .letter { background: var(--sl-blue); color: var(--sl-white); }
.option[data-look='correct'] { border-color: var(--sl-green-ink); }
.option[data-look='correct'] .letter { background: var(--sl-green-ink); color: var(--sl-white); }
.option[data-look='wrong'] { border-color: var(--sl-red-ink); }
.option[data-look='wrong'] .letter { background: var(--sl-red-ink); color: var(--sl-white); }
</style>
