<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { list, num, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import QuestionFooter from './QuestionFooter.vue';
import { useQuestionState } from './question-state.ts';
import { seededShuffle } from './render-helpers.ts';

const props = defineProps<CatalogComponentProps>();
const student = computed(() => props.mode === 'student');
const correct = computed(() => list(props.data.items).map((item) => str(item)));
const order = ref<number[]>([]);
const marks = ref<(boolean | null)[]>([]);
const dragging = ref<number | null>(null);
const state = useQuestionState(() => props.elementId, () => num(props.data.attempts, 1));

function reset(): void {
  const indexes = correct.value.map((_, index) => index);
  order.value = student.value ? seededShuffle(indexes, `${props.elementId}${correct.value.join('|')}`, true) : indexes;
  marks.value = indexes.map(() => null);
  state.reset();
}

watch(() => [props.data, props.mode], reset, { immediate: true });

function move(from: number, to: number): void {
  if (state.locked.value || to < 0 || to >= order.value.length || from === to) return;
  const next = [...order.value];
  const [item] = next.splice(from, 1);
  if (item === undefined) return;
  next.splice(to, 0, item);
  order.value = next;
  marks.value = next.map(() => null);
}

function drop(to: number): void {
  if (dragging.value !== null) move(dragging.value, to);
  dragging.value = null;
}

function check(): void {
  marks.value = order.value.map((item, position) => item === position);
  state.answer(marks.value.every((mark) => mark === true));
}
</script>

<template>
  <div class="el-ordering" data-testid="question-ordering">
    <span v-if="student" class="hint">Ordena los elementos</span>
    <ol class="items">
      <li
        v-for="(item, position) in order"
        :key="item"
        class="item"
        :data-mark="marks[position] === null ? 'none' : marks[position] ? 'ok' : 'wrong'"
        :draggable="student && !state.locked.value"
        @dragstart="dragging = position"
        @dragover.prevent
        @drop.prevent="drop(position)"
        @click.stop
      >
        <svg viewBox="0 0 24 24" class="grip" aria-hidden="true"><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></svg>
        <span class="number" aria-hidden="true">{{ position + 1 }}</span>
        <span class="text">{{ correct[item] }}</span>
        <span v-if="student" class="moves">
          <button type="button" class="move" :aria-label="`Subir ${correct[item]}`" :disabled="position === 0 || state.locked.value" @click.stop="move(position, position - 1)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6" /></svg>
          </button>
          <button type="button" class="move" :aria-label="`Bajar ${correct[item]}`" :disabled="position === order.length - 1 || state.locked.value" @click.stop="move(position, position + 1)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          </button>
        </span>
      </li>
    </ol>
    <QuestionFooter v-if="student" :state="state" :can-check="true" :feedback-correct="str(data.feedbackCorrect)" :feedback-incorrect="str(data.feedbackIncorrect)" @check="check" />
  </div>
</template>

<style scoped>
.el-ordering { display: flex; flex-direction: column; gap: 1cqw; }
.hint { font-size: 1.3cqw; color: var(--sl-fg-2); }
.items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1cqw; }
.item { display: flex; align-items: center; gap: 1.2cqw; padding: 1cqw 1.4cqw; font-size: 1.6cqw; background: var(--sl-card); border: 0.12cqw solid var(--sl-line); border-radius: 1.2cqw; color: var(--sl-ink); }
.item[draggable='true'] { cursor: grab; }
.item[data-mark='ok'] { border-color: var(--sl-green-ink); background: var(--sl-green-soft); }
.item[data-mark='wrong'] { border-color: var(--sl-red-ink); background: var(--sl-red-soft); }
.grip { width: 1.8cqw; height: 1.8cqw; flex: none; fill: var(--sl-ink-4); }
.number { width: 2.8cqw; height: 2.8cqw; flex: none; border-radius: 0.8cqw; background: var(--sl-blue-soft); color: var(--sl-blue); display: flex; align-items: center; justify-content: center; font-size: 1.4cqw; font-weight: 600; }
.text { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.moves { display: flex; gap: 0.4cqw; }
.move { width: 2.6cqw; height: 2.6cqw; padding: 0; display: flex; align-items: center; justify-content: center; background: var(--sl-card-alt); border: 0.12cqw solid var(--sl-line); border-radius: 0.6cqw; color: var(--sl-ink-2); cursor: pointer; }
.move:disabled { opacity: 0.35; cursor: not-allowed; }
.move:focus-visible { outline: 0.25cqw solid var(--sl-blue); outline-offset: 0.2cqw; }
.move svg { width: 70%; height: 70%; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
</style>
