<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { num, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import QuestionFooter from './QuestionFooter.vue';
import { useQuestionState } from './question-state.ts';
import { seededShuffle } from './render-helpers.ts';

type Part = { kind: 'text'; text: string } | { kind: 'blank'; answer: string; index: number };

const props = defineProps<CatalogComponentProps>();
const student = computed(() => props.mode === 'student');
const parts = computed<Part[]>(() => {
  const text = str(props.data.text);
  const result: Part[] = [];
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(/\[\[(.+?)\]\]/g)) {
    if (match.index > last) result.push({ kind: 'text', text: text.slice(last, match.index) });
    result.push({ kind: 'blank', answer: (match[1] ?? '').trim(), index });
    index += 1;
    last = match.index + match[0].length;
  }
  if (last < text.length) result.push({ kind: 'text', text: text.slice(last) });
  return result;
});
const answers = computed(() => parts.value.flatMap((part) => (part.kind === 'blank' ? [part.answer] : [])));
const bank = computed(() => (student.value ? seededShuffle(answers.value, `${props.elementId}${str(props.data.text)}`) : answers.value));
const values = ref<string[]>([]);
const marks = ref<(boolean | null)[]>([]);
const focused = ref<number | null>(null);
const state = useQuestionState(() => props.elementId, () => num(props.data.attempts, 1));

function normalize(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return props.data.caseSensitive === true ? trimmed : trimmed.toLocaleLowerCase('es');
}

function reset(): void {
  values.value = answers.value.map(() => '');
  marks.value = answers.value.map(() => null);
  state.reset();
}

watch(() => props.data, reset, { immediate: true });

function setValue(index: number, value: string): void {
  values.value = values.value.map((current, position) => (position === index ? value : current));
  marks.value = marks.value.map(() => null);
}

function useWord(word: string): void {
  if (state.locked.value) return;
  const target = focused.value !== null && values.value[focused.value] === '' ? focused.value : values.value.findIndex((value) => value === '');
  setValue(target >= 0 ? target : (focused.value ?? 0), word);
}

function check(): void {
  marks.value = answers.value.map((answer, index) => normalize(values.value[index] ?? '') === normalize(answer));
  state.answer(marks.value.every((mark) => mark === true));
}

function onInput(event: Event, index: number): void {
  setValue(index, event.target instanceof HTMLInputElement ? event.target.value : '');
}
</script>

<template>
  <div class="el-fill" data-testid="question-fill-blank">
    <p class="text">
      <template v-for="(part, key) in parts" :key="key">
        <template v-if="part.kind === 'text'">{{ part.text }}</template>
        <input
          v-else-if="student"
          class="blank"
          type="text"
          :value="values[part.index] ?? ''"
          :aria-label="`Espacio ${part.index + 1}`"
          :data-mark="marks[part.index] === null ? 'none' : marks[part.index] ? 'ok' : 'wrong'"
          :disabled="state.locked.value"
          :style="{ width: `${Math.max(10, part.answer.length * 1.25 + 3)}cqw` }"
          :data-testid="`question-blank-${part.index}`"
          @click.stop
          @focus="focused = part.index"
          @input="onInput($event, part.index)"
        />
        <span v-else class="blank">{{ part.answer }}</span>
      </template>
    </p>
    <div class="bank">
      <span class="bank-label">Banco de palabras</span>
      <component :is="student ? 'button' : 'span'" v-for="(word, index) in bank" :key="index" :type="student ? 'button' : undefined" class="chip" :disabled="student ? state.locked.value : undefined" @click.stop="student && useWord(word)">{{ word }}</component>
    </div>
    <QuestionFooter :interactive="student" :design="design" :design-hidden="designHidden" :state="state" :can-check="values.every((value) => value.trim() !== '')" :feedback-correct="str(data.feedbackCorrect)" :feedback-incorrect="str(data.feedbackIncorrect)" @check="check" />
  </div>
</template>

<style scoped>
.el-fill { display: flex; flex-direction: column; gap: 1.6cqw; }
.text { margin: 0; font-size: 2cqw; line-height: 2.1; color: var(--sl-fg); overflow-wrap: anywhere; }
.blank { display: inline-block; min-width: 10cqw; box-sizing: border-box; margin: 0 0.5cqw; padding: 0 1cqw; border: 0; border-bottom: 0.3cqw solid var(--sl-blue); border-radius: 0.6cqw 0.6cqw 0 0; background: var(--sl-blue-soft); color: var(--sl-blue); font: inherit; font-weight: 600; text-align: center; line-height: 1.6; vertical-align: baseline; }
input.blank { outline: none; }
input.blank:focus-visible { box-shadow: 0 0 0 0.25cqw var(--sl-blue); }
.blank[data-mark='ok'] { border-bottom-color: var(--sl-green-ink); background: var(--sl-green-soft); color: var(--sl-green-ink); }
.blank[data-mark='wrong'] { border-bottom-color: var(--sl-red-ink); background: var(--sl-red-soft); color: var(--sl-red-ink); }
.bank { display: flex; align-items: center; gap: 1cqw; flex-wrap: wrap; }
.bank-label { font-size: 1.4cqw; color: var(--sl-fg-2); }
.chip { padding: 0.7cqw 1.3cqw; border-radius: 99cqw; font: inherit; font-size: 1.5cqw; white-space: nowrap; background: var(--sl-card); border: 0.15cqw solid var(--sl-line-3); color: var(--sl-ink); }
button.chip { cursor: pointer; }
button.chip:hover:not(:disabled) { border-color: var(--sl-blue); }
button.chip:focus-visible { outline: 0.25cqw solid var(--sl-blue); outline-offset: 0.2cqw; }
</style>
