<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { list, num, rec, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import QuestionFooter from './QuestionFooter.vue';
import { useQuestionState } from './question-state.ts';
import { seededShuffle } from './render-helpers.ts';

const props = defineProps<CatalogComponentProps>();
const student = computed(() => props.mode === 'student');
const items = computed(() => list(props.data.items).map((item) => ({ id: str(rec(item).id), text: str(rec(item).text) })));
const targets = computed(() => list(props.data.targets).map((item) => ({ id: str(rec(item).id), text: str(rec(item).text), correct: str(rec(item).correctItemId) })));
/** Item placed in each target, by target id. */
const placed = ref<Record<string, string | null>>({});
const marks = ref<Record<string, boolean | null>>({});
const held = ref<string | null>(null);
const state = useQuestionState(() => props.elementId, () => num(props.data.attempts, 1));

function reset(): void {
  placed.value = Object.fromEntries(targets.value.map((target) => [target.id, student.value ? null : target.correct]));
  marks.value = Object.fromEntries(targets.value.map((target) => [target.id, null]));
  held.value = null;
  state.reset();
}

watch(() => [props.data, props.mode], reset, { immediate: true });

const used = computed(() => new Set(Object.values(placed.value).filter((value): value is string => value !== null)));
const bank = computed(() => {
  const free = items.value.filter((item) => !used.value.has(item.id));
  return student.value ? seededShuffle(free, `${props.elementId}${items.value.map((item) => item.id).join('|')}`) : free;
});

function textOf(id: string | null | undefined): string {
  return items.value.find((item) => item.id === id)?.text ?? '';
}

function place(targetId: string, itemId: string | null): void {
  if (state.locked.value || itemId === null) return;
  const next: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(placed.value)) next[key] = value === itemId ? null : value;
  next[targetId] = itemId;
  placed.value = next;
  marks.value = Object.fromEntries(targets.value.map((target) => [target.id, null]));
  held.value = null;
}

function takeBack(targetId: string): void {
  if (state.locked.value) return;
  placed.value = { ...placed.value, [targetId]: null };
  marks.value = Object.fromEntries(targets.value.map((target) => [target.id, null]));
}

function onDragStart(event: DragEvent, itemId: string): void {
  held.value = itemId;
  event.dataTransfer?.setData('text/plain', itemId);
}

function check(): void {
  marks.value = Object.fromEntries(targets.value.map((target) => [target.id, placed.value[target.id] === target.correct]));
  state.answer(Object.values(marks.value).every((mark) => mark === true));
}

const zoneColors = (index: number): { line: string; tint: string } =>
  index % 2 === 0 ? { line: 'var(--sl-blue)', tint: 'var(--sl-blue-tint)' } : { line: 'var(--sl-cyan-ink)', tint: 'var(--sl-cyan-tint)' };
</script>

<template>
  <div class="el-dd" data-testid="question-drag-drop">
    <div v-if="student || bank.length > 0" class="bank" role="group" aria-label="Elementos para arrastrar">
      <component
        :is="student ? 'button' : 'span'"
        v-for="item in bank"
        :key="item.id"
        :type="student ? 'button' : undefined"
        class="chip"
        :data-held="held === item.id"
        :draggable="student && !state.locked.value"
        :aria-pressed="student ? held === item.id : undefined"
        :disabled="student ? state.locked.value : undefined"
        @dragstart="onDragStart($event, item.id)"
        @click.stop="student && (held = held === item.id ? null : item.id)"
      >
        <svg viewBox="0 0 24 24" class="grip" aria-hidden="true"><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></svg>
        {{ item.text }}
      </component>
    </div>
    <div class="zones" :style="{ gridTemplateColumns: `repeat(${Math.min(Math.max(targets.length, 1), 4)}, 1fr)` }">
      <div
        v-for="(target, index) in targets"
        :key="target.id"
        class="zone"
        :data-mark="marks[target.id] === null || marks[target.id] === undefined ? 'none' : marks[target.id] ? 'ok' : 'wrong'"
        :style="{ borderColor: zoneColors(index).line, background: zoneColors(index).tint }"
        @dragover.prevent
        @drop.prevent="place(target.id, held)"
        @click.stop="student && place(target.id, held)"
      >
        <span class="zone-title" :style="{ color: zoneColors(index).line }">{{ target.text }}</span>
        <component
          :is="student ? 'button' : 'span'"
          v-if="placed[target.id]"
          :type="student ? 'button' : undefined"
          class="chip placed"
          :style="{ borderColor: zoneColors(index).line }"
          :aria-label="student ? `Quitar ${textOf(placed[target.id])} de ${target.text}` : undefined"
          @click.stop="student && takeBack(target.id)"
        >{{ textOf(placed[target.id]) }}</component>
        <span v-else-if="student" class="drop">{{ held ? 'Suelta aquí' : 'Arrastra aquí' }}</span>
      </div>
    </div>
    <QuestionFooter v-if="student" :state="state" :can-check="targets.every((target) => placed[target.id])" :feedback-correct="str(data.feedbackCorrect)" :feedback-incorrect="str(data.feedbackIncorrect)" @check="check" />
  </div>
</template>

<style scoped>
.el-dd { height: 100%; display: flex; flex-direction: column; gap: 1.4cqw; }
.bank { display: flex; gap: 1cqw; flex-wrap: wrap; min-height: 3.4cqw; }
.chip { padding: 0.7cqw 1.3cqw; border-radius: 99cqw; font: inherit; font-size: 1.5cqw; white-space: nowrap; display: inline-flex; align-items: center; gap: 0.6cqw; background: var(--sl-card); border: 0.15cqw solid var(--sl-line-3); box-shadow: 0 0.3cqw 0.8cqw var(--sl-shadow); color: var(--sl-ink); }
button.chip { cursor: grab; }
button.chip:focus-visible { outline: 0.25cqw solid var(--sl-blue); outline-offset: 0.2cqw; }
.chip[data-held='true'] { border-color: var(--sl-blue); box-shadow: 0 0 0 0.2cqw var(--sl-blue-soft); }
.chip.placed { box-shadow: none; cursor: pointer; }
.grip { width: 1.6cqw; height: 1.6cqw; flex: none; fill: var(--sl-ink-4); }
.zones { flex: 1; display: grid; gap: 1.6cqw; }
.zone { padding: 1.2cqw; border: 0.2cqw dashed; border-radius: 1.2cqw; display: flex; flex-direction: column; align-items: flex-start; gap: 0.8cqw; min-height: 6cqw; }
.zone[data-mark='ok'] { border-style: solid; border-color: var(--sl-green-ink) !important; }
.zone[data-mark='wrong'] { border-style: solid; border-color: var(--sl-red-ink) !important; }
.zone-title { font-size: 1.7cqw; font-weight: 600; }
.drop { font-size: 1.3cqw; color: var(--sl-ink-3); }
</style>
