<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { list, num, rec, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import QuestionFooter from './QuestionFooter.vue';
import { toneVars } from './tone.ts';
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
  <div class="el-mc" :style="toneVars(data.color, 'primary')" :data-live="student" data-testid="question-multiple-choice">
    <span class="question">{{ str(data.question) }}</span>
    <div class="options" :data-columns="num(data.columns, 2) === 1 ? 1 : 2" role="radiogroup" :aria-label="str(data.question)">
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
    <QuestionFooter :interactive="student" :confetti="data.confetti !== false" :design="design" :design-hidden="designHidden" :state="state" :can-check="picked !== null && checked !== picked" :feedback-correct="str(data.feedbackCorrect)" :feedback-incorrect="str(data.feedbackIncorrect)" @check="check" />
  </div>
</template>

<style scoped>
.el-mc { display: flex; flex-direction: column; gap: 1.4cqw; }
.question { font-size: 2.1cqw; font-weight: 600; line-height: 1.3; color: var(--sl-fg); }
.options { display: grid; grid-template-columns: 1fr 1fr; gap: 1.2cqw; }
.options[data-columns='1'] { grid-template-columns: 1fr; }
.option { display: flex; align-items: center; gap: 1.4cqw; padding: 1.3cqw 1.6cqw; background: var(--sl-card); border: 0.2cqw solid var(--sl-line); border-radius: 1.2cqw; color: var(--sl-ink); font: inherit; font-size: 1.8cqw; text-align: left; }
.option:not(:disabled) { cursor: pointer; }
.option:not(:disabled):hover { border-color: var(--c-ink); }
.option:focus-visible { outline: 0.25cqw solid var(--c); outline-offset: 0.2cqw; }
.letter { width: 3.2cqw; height: 3.2cqw; flex: none; border-radius: 0.9cqw; background: var(--c-soft); color: var(--c-ink); display: flex; align-items: center; justify-content: center; font-size: 1.5cqw; font-weight: 600; }
.text { min-width: 0; overflow-wrap: anywhere; }
.key { margin-left: auto; font-size: 1.2cqw; font-weight: 600; color: var(--sl-green-ink); white-space: nowrap; }
.option[data-look='picked'] { border-color: var(--c-ink); }
.option[data-look='picked'] .letter { background: var(--c); color: var(--c-on); }
.option[data-look='correct'] { border-color: var(--sl-green-ink); }
.option[data-look='correct'] .letter { background: var(--sl-green-ink); color: var(--sl-white); }
.option[data-look='wrong'] { border-color: var(--sl-red-ink); }
.option[data-look='wrong'] .letter { background: var(--sl-red-ink); color: var(--sl-white); }
.el-mc[data-live='true'] .option[data-look='correct'] { background: var(--sl-green-soft); animation: sl-correct 0.5s var(--sl-ease-bounce); }
.el-mc[data-live='true'] .option[data-look='wrong'] { background: var(--sl-red-soft); animation: sl-shake 0.45s ease; }
.option { transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s var(--sl-ease-bounce); box-shadow: var(--sl-elev-1); }
.option:not(:disabled):hover { transform: translateY(-0.15cqw); }
</style>
