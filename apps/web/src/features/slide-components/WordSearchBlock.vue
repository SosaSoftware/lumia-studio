<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ThemeColorKey } from '@lumia/packages/catalog';
import { list, num, str } from '../../api/decode.ts';
import { burstConfetti } from './confetti.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { seededRandom, useCompletion } from './motion.ts';
import { toneVars, vividColor } from './tone.ts';
import { WordSearchGrid, lineBetween } from './word-search-grid.ts';
import type { GridCell } from './word-search-grid.ts';

const props = defineProps<CatalogComponentProps>();
const root = ref<HTMLElement | null>(null);
const student = computed(() => props.mode === 'student');
const report = useCompletion(() => props.elementId);
const words = computed(() => list(props.data.words).map((word) => str(word)));
const size = computed(() => Math.min(14, Math.max(8, Math.round(num(props.data.size, 10)))));

const grid = computed(
  () =>
    new WordSearchGrid(
      words.value,
      { size: size.value, diagonal: props.data.diagonal !== false, backwards: props.data.backwards === true },
      seededRandom(`${props.elementId}|${words.value.join(',')}|${String(size.value)}|${String(props.data.diagonal)}|${String(props.data.backwards)}`),
    ),
);

/** Found words with the color each one got, in the order they were found. */
const found = ref<Map<string, ThemeColorKey>>(new Map());
const start = ref<GridCell | null>(null);
const end = ref<GridCell | null>(null);
const flash = ref(false);
const won = computed(() => grid.value.placements.length > 0 && found.value.size === grid.value.placements.length);

function reset(): void {
  found.value = new Map();
  start.value = null;
  end.value = null;
  report(false);
}

watch(() => [props.data, props.mode] as const, reset, { immediate: true });

const selection = computed(() => (start.value === null || end.value === null ? [] : lineBetween(start.value, end.value)));
const selectedCells = computed(() => new Set(selection.value.map((cell) => `${String(cell.row)}:${String(cell.column)}`)));

/** Color of each found cell; in the editor every hidden word is shown so the author can check the board. */
const painted = computed(() => {
  const result = new Map<string, ThemeColorKey>();
  grid.value.placements.forEach((placement, index) => {
    const color = found.value.get(placement.word) ?? (student.value ? null : vividColor(index));
    if (color === null) return;
    for (const cell of placement.cells) result.set(`${String(cell.row)}:${String(cell.column)}`, color);
  });
  return result;
});

function cellAt(event: PointerEvent): GridCell | null {
  const target = document.elementFromPoint(event.clientX, event.clientY);
  if (!(target instanceof HTMLElement) || target.dataset.row === undefined || target.dataset.column === undefined) return null;
  return { row: Number(target.dataset.row), column: Number(target.dataset.column) };
}

function onDown(event: PointerEvent): void {
  if (!student.value || won.value) return;
  const cell = cellAt(event);
  if (cell === null) return;
  if (event.currentTarget instanceof HTMLElement) event.currentTarget.setPointerCapture(event.pointerId);
  start.value = cell;
  end.value = cell;
}

function onMove(event: PointerEvent): void {
  if (start.value === null) return;
  const cell = cellAt(event);
  if (cell !== null && lineBetween(start.value, cell).length > 0) end.value = cell;
}

function onUp(): void {
  if (start.value === null) return;
  const match = grid.value.match(selection.value);
  if (match !== null && !found.value.has(match.word)) {
    const next = new Map(found.value);
    next.set(match.word, vividColor(grid.value.placements.indexOf(match)));
    found.value = next;
    if (won.value) {
      report(true);
      if (props.data.confetti !== false) burstConfetti(root.value, 'high');
    }
  } else if (selection.value.length > 1) {
    flash.value = true;
    setTimeout(() => {
      flash.value = false;
    }, 400);
  }
  start.value = null;
  end.value = null;
}

const title = computed(() => str(props.data.title).trim());
</script>

<template>
  <div ref="root" class="el-word-search" :style="toneVars(data.color, 'primary')" data-testid="word-search">
    <div
      class="board"
      :data-flash="flash"
      :style="{ gridTemplateColumns: `repeat(${size}, 1fr)` }"
      role="grid"
      :aria-label="`Sopa de letras de ${size} por ${size}`"
      @pointerdown.stop="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    >
      <template v-for="(row, r) in grid.letters" :key="r">
        <span
          v-for="(letterValue, c) in row"
          :key="`${r}-${c}`"
          class="cell"
          role="gridcell"
          :data-row="r"
          :data-column="c"
          :data-selected="selectedCells.has(`${r}:${c}`)"
          :data-found="painted.has(`${r}:${c}`)"
          :style="painted.has(`${r}:${c}`) ? toneVars(painted.get(`${r}:${c}`)) : undefined"
        >{{ letterValue }}</span>
      </template>
    </div>
    <aside class="side">
      <span v-if="title" class="title">{{ title }}</span>
      <ul class="words">
        <li v-for="(placement, index) in grid.placements" :key="placement.word" class="word" :data-found="found.has(placement.word)" :style="toneVars(found.get(placement.word) ?? vividColor(index))">
          <span class="word-dot" aria-hidden="true"></span>{{ placement.word }}
        </li>
      </ul>
      <span class="counter">{{ found.size }} / {{ grid.placements.length }}</span>
      <span v-if="won" class="win" role="status">{{ str(data.feedbackCorrect) }}</span>
      <span v-if="!student && grid.skipped.length" class="warning">No caben: {{ grid.skipped.join(', ') }}. Agranda la cuadrícula.</span>
    </aside>
  </div>
</template>

<style scoped>
.el-word-search { position: relative; width: 100%; height: 100%; display: flex; gap: 2cqw; }
.board { height: 100%; aspect-ratio: 1; max-width: 62%; display: grid; gap: 0.2cqw; padding: 0.8cqw; box-sizing: border-box; background: var(--sl-card); border: 0.12cqw solid var(--sl-line); border-radius: 1.4cqw; box-shadow: var(--sl-elev-1); user-select: none; touch-action: none; }
.board[data-flash='true'] { animation: sl-shake 0.35s ease; }
.cell { display: flex; align-items: center; justify-content: center; min-width: 0; min-height: 0; border-radius: 0.5cqw; font-size: 1.45cqw; font-weight: 600; color: var(--sl-ink-2); font-family: var(--sl-font-mono); cursor: pointer; transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease; }
.cell[data-found='true'] { background: var(--c); color: var(--c-on); }
.cell[data-selected='true'] { background: var(--sl-ink); color: var(--sl-white); transform: scale(1.08); }
.side { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.9cqw; }
.title { font-size: 1.8cqw; font-weight: 600; line-height: 1.25; color: var(--sl-fg); }
.words { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.6cqw; }
.word { display: inline-flex; align-items: center; gap: 0.5cqw; padding: 0.4cqw 1cqw; border-radius: 99cqw; background: var(--sl-card); border: 0.12cqw solid var(--sl-line); font-size: 1.3cqw; font-weight: 600; color: var(--sl-ink); letter-spacing: 0.04em; }
.word-dot { width: 0.8cqw; height: 0.8cqw; border-radius: 50%; background: var(--sl-line-2); }
.word[data-found='true'] { background: var(--c-soft); border-color: var(--c); color: var(--c-ink); text-decoration: line-through; animation: sl-correct 0.4s var(--sl-ease-bounce); }
.word[data-found='true'] .word-dot { background: var(--c); }
.counter { font-size: 1.3cqw; color: var(--sl-fg-2); }
.win { font-size: 1.6cqw; font-weight: 600; color: var(--sl-success-ink); animation: sl-zoom 0.4s var(--sl-ease-bounce) both; }
.warning { font-size: 1.2cqw; color: var(--sl-danger-ink); }
</style>
