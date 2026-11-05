<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { list, num, rec, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import QuestionFooter from './QuestionFooter.vue';
import { useQuestionState } from './question-state.ts';
import { letter, seededShuffle } from './render-helpers.ts';

const props = defineProps<CatalogComponentProps>();
const student = computed(() => props.mode === 'student');
const pairs = computed(() => list(props.data.pairs).map((item) => ({ left: str(rec(item).left), right: str(rec(item).right) })));
/** Positions of the right column: index of the pair shown in each row. */
const rightOrder = computed(() => seededShuffle(pairs.value.map((_, index) => index), `${props.elementId}${pairs.value.map((pair) => pair.right).join('|')}`, true));
const links = ref<(number | null)[]>([]);
const marks = ref<(boolean | null)[]>([]);
const active = ref<number | null>(null);
const state = useQuestionState(() => props.elementId, () => num(props.data.attempts, 1));
const root = ref<HTMLElement | null>(null);
const lines = ref<{ y1: number; y2: number; key: number; mark: boolean | null }[]>([]);
let observer: ResizeObserver | null = null;

function reset(): void {
  links.value = pairs.value.map((_, index) => (student.value ? null : index));
  marks.value = pairs.value.map(() => null);
  active.value = null;
  state.reset();
}

watch(() => [props.data, props.mode], reset, { immediate: true });

/** Vertical centers of the rows, measured so the lines meet the dots whatever the text wraps to. */
function measure(): void {
  const element = root.value;
  if (element === null) return;
  const box = element.querySelector('.middle')?.getBoundingClientRect();
  if (box === undefined || box.height === 0) return;
  const centers = (selector: string): number[] => [...element.querySelectorAll(selector)].map((row) => {
    const rect = row.getBoundingClientRect();
    return ((rect.top + rect.height / 2 - box.top) / box.height) * 100;
  });
  const left = centers('.left .match');
  const right = centers('.right .match');
  lines.value = links.value.flatMap((pair, leftIndex) => {
    if (pair === null) return [];
    const rightRow = rightOrder.value.indexOf(pair);
    const y1 = left[leftIndex];
    const y2 = right[rightRow];
    return y1 === undefined || y2 === undefined ? [] : [{ y1, y2, key: leftIndex, mark: marks.value[leftIndex] ?? null }];
  });
}

watch([links, marks, rightOrder], () => void nextTick(measure), { deep: true });
onMounted(() => {
  void nextTick(measure);
  if (root.value !== null) {
    observer = new ResizeObserver(measure);
    observer.observe(root.value);
  }
});
onBeforeUnmount(() => observer?.disconnect());

function pickLeft(index: number): void {
  if (!student.value || state.locked.value) return;
  active.value = active.value === index ? null : index;
}

function pickRight(pair: number): void {
  if (!student.value || state.locked.value) return;
  const left = active.value;
  if (left === null) {
    const owner = links.value.indexOf(pair);
    if (owner >= 0) links.value = links.value.map((value, index) => (index === owner ? null : value));
    return;
  }
  links.value = links.value.map((value, index) => (index === left ? pair : value === pair ? null : value));
  marks.value = marks.value.map(() => null);
  active.value = null;
}

function check(): void {
  marks.value = links.value.map((pair, index) => pair === index);
  state.answer(marks.value.every((mark) => mark === true));
}
</script>

<template>
  <div ref="root" class="el-matching" data-testid="question-matching">
    <div class="grid">
      <div class="left">
        <button
          v-for="(pair, index) in pairs"
          :key="index"
          type="button"
          class="match"
          :data-active="active === index"
          :data-mark="marks[index] === null ? 'none' : marks[index] ? 'ok' : 'wrong'"
          :disabled="!student || state.locked.value"
          :tabindex="student ? 0 : -1"
          :aria-pressed="active === index"
          @click.stop="pickLeft(index)"
        >
          <span class="number" aria-hidden="true">{{ index + 1 }}</span>
          <span class="text">{{ pair.left }}</span>
          <span class="ring blue" aria-hidden="true"></span>
        </button>
      </div>
      <svg class="middle" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <line v-for="line in lines" :key="line.key" x1="0" :y1="line.y1" x2="100" :y2="line.y2" :data-mark="line.mark === null ? 'none' : line.mark ? 'ok' : 'wrong'" vector-effect="non-scaling-stroke" />
      </svg>
      <div class="right">
        <button
          v-for="(pairIndex, row) in rightOrder"
          :key="pairIndex"
          type="button"
          class="match"
          :disabled="!student || state.locked.value"
          :tabindex="student ? 0 : -1"
          @click.stop="pickRight(pairIndex)"
        >
          <span class="ring cyan" aria-hidden="true"></span>
          <span class="badge" aria-hidden="true">{{ letter(row) }}</span>
          <span class="text">{{ pairs[pairIndex]?.right }}</span>
        </button>
      </div>
    </div>
    <QuestionFooter v-if="student" :state="state" :can-check="links.every((link) => link !== null)" :feedback-correct="str(data.feedbackCorrect)" :feedback-incorrect="str(data.feedbackIncorrect)" @check="check" />
  </div>
</template>

<style scoped>
.el-matching { display: flex; flex-direction: column; gap: 1.4cqw; }
.grid { display: grid; grid-template-columns: 1fr 5cqw 1fr; align-items: stretch; }
.left, .right { display: flex; flex-direction: column; gap: 1.2cqw; }
.match { display: flex; align-items: center; gap: 1.2cqw; padding: 1.1cqw 1.4cqw; background: var(--sl-card); border: 0.12cqw solid var(--sl-line); border-radius: 1.2cqw; color: var(--sl-ink); font: inherit; text-align: left; }
.match:not(:disabled) { cursor: pointer; }
.match:not(:disabled):hover { border-color: var(--sl-blue); }
.match:focus-visible { outline: 0.25cqw solid var(--sl-blue); outline-offset: 0.2cqw; }
.match[data-active='true'] { border-color: var(--sl-blue); box-shadow: 0 0 0 0.2cqw var(--sl-blue-soft); }
.match[data-mark='ok'] { border-color: var(--sl-green-ink); }
.match[data-mark='wrong'] { border-color: var(--sl-red-ink); }
.number { width: 2.8cqw; height: 2.8cqw; flex: none; border-radius: 50%; background: var(--sl-blue); color: var(--sl-white); display: flex; align-items: center; justify-content: center; font-size: 1.4cqw; font-weight: 600; }
.badge { width: 2.8cqw; height: 2.8cqw; flex: none; border-radius: 0.8cqw; background: var(--sl-cyan-soft); color: var(--sl-cyan-ink); display: flex; align-items: center; justify-content: center; font-size: 1.4cqw; font-weight: 600; }
.text { flex: 1; min-width: 0; font-size: 1.6cqw; overflow-wrap: anywhere; }
.ring { width: 1.3cqw; height: 1.3cqw; flex: none; box-sizing: border-box; border-radius: 50%; }
.ring.blue { border: 0.3cqw solid var(--sl-blue); }
.ring.cyan { border: 0.3cqw solid var(--sl-cyan); }
.middle { width: 100%; height: 100%; overflow: visible; }
.middle line { stroke: var(--sl-blue); stroke-width: 2.5; }
.middle line[data-mark='ok'] { stroke: var(--sl-green-ink); }
.middle line[data-mark='wrong'] { stroke: var(--sl-red-ink); }
</style>
