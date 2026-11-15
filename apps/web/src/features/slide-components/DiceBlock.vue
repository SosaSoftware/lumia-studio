<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { list, num, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { prefersReducedMotion } from './motion.ts';
import { toneVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const student = computed(() => props.mode === 'student');
const count = computed(() => Math.min(2, Math.max(1, Math.round(num(props.data.count, 1)))));
const custom = computed(() => list(props.data.faces).map((face) => str(face).trim()).filter((face) => face !== ''));
/** Number of faces: the custom ones, or six pips. */
const sides = computed(() => (custom.value.length > 0 ? custom.value.length : 6));
const values = ref<number[]>([]);
const rolling = ref(false);
const rolled = ref(false);
let ticker: ReturnType<typeof setInterval> | null = null;
let stopper: ReturnType<typeof setTimeout> | null = null;

/** Cells of the 3 × 3 grid that hold a pip, for each value from 1 to 6. */
const PIPS: Readonly<Record<number, readonly number[]>> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function resting(): number[] {
  return Array.from({ length: count.value }, (_, index) => (index === 0 ? Math.min(5, sides.value) : Math.min(3, sides.value)));
}

function random(): number[] {
  return Array.from({ length: count.value }, () => 1 + Math.floor(Math.random() * sides.value));
}

function clear(): void {
  if (ticker !== null) clearInterval(ticker);
  if (stopper !== null) clearTimeout(stopper);
  ticker = null;
  stopper = null;
}

watch(
  [count, sides],
  () => {
    clear();
    rolling.value = false;
    rolled.value = false;
    values.value = resting();
  },
  { immediate: true },
);

function roll(): void {
  if (!student.value || rolling.value) return;
  rolling.value = true;
  const reduced = prefersReducedMotion();
  if (!reduced) {
    ticker = setInterval(() => {
      values.value = random();
    }, 90);
  }
  stopper = setTimeout(
    () => {
      clear();
      values.value = random();
      rolling.value = false;
      rolled.value = true;
    },
    reduced ? 10 : 900,
  );
}

const total = computed(() => values.value.reduce((sum, value) => sum + value, 0));
const label = computed(() => values.value.map((value) => (custom.value.length > 0 ? (custom.value[value - 1] ?? '') : String(value))).join(' y '));
onBeforeUnmount(clear);
</script>

<template>
  <div class="el-dice" :data-rolling="rolling" :style="toneVars(data.color, 'danger')" data-testid="dice">
    <component :is="student ? 'button' : 'div'" :type="student ? 'button' : undefined" class="tray" :aria-label="student ? 'Lanzar el dado' : undefined" @click.stop="roll">
      <span v-for="(value, index) in values" :key="index" class="die" :style="{ animationDelay: `${index * 0.08}s` }" aria-hidden="true">
        <span v-if="custom.length > 0" class="face-text" :data-long="(custom[value - 1] ?? '').length > 3">{{ custom[value - 1] }}</span>
        <span v-else class="pips">
          <span v-for="cell in 9" :key="cell" class="cell"><span v-if="PIPS[value]?.includes(cell - 1)" class="pip"></span></span>
        </span>
      </span>
    </component>
    <span class="caption" role="status">
      <template v-if="rolled">{{ custom.length === 0 && count > 1 && data.showTotal !== false ? `${label} · Total: ${total}` : label }}</template>
      <template v-else-if="student">Toca para lanzar</template>
    </span>
  </div>
</template>

<style scoped>
.el-dice { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1cqw; }
.tray { flex: 1; min-height: 0; width: 100%; display: flex; align-items: center; justify-content: center; gap: 1.6cqw; padding: 0; border: 0; background: transparent; font: inherit; }
button.tray { cursor: pointer; }
button.tray:focus-visible { outline: 0.25cqw solid var(--c); outline-offset: 0.3cqw; border-radius: 1.4cqw; }
.die { height: min(100%, 11cqw); aspect-ratio: 1; box-sizing: border-box; display: flex; align-items: center; justify-content: center; padding: 14%; border-radius: 22%; background: var(--c-grad); color: var(--c-on); box-shadow: inset 0 -0.6cqw 0 rgba(0, 0, 0, 0.12), inset 0 0.4cqw 0 rgba(255, 255, 255, 0.3), var(--sl-elev-2); transition: transform 0.2s var(--sl-ease-bounce); }
button.tray:hover .die { transform: rotate(-6deg) scale(1.04); }
[data-rolling='true'] .die { animation: dice-roll 0.3s linear infinite; }
.pips { width: 100%; height: 100%; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); }
.cell { display: flex; align-items: center; justify-content: center; }
.pip { width: 72%; height: 72%; border-radius: 50%; background: var(--sl-white); box-shadow: inset 0 0.15cqw 0.2cqw rgba(0, 0, 0, 0.25); }
.face-text { font-size: 3.2cqw; font-weight: 600; line-height: 1; text-align: center; overflow-wrap: anywhere; }
.face-text[data-long='true'] { font-size: 1.6cqw; }
.caption { flex: none; min-height: 1.8cqw; font-size: 1.4cqw; font-weight: 600; color: var(--sl-fg-2); text-align: center; }

@keyframes dice-roll {
  0% { transform: rotate(0deg) translateY(0); }
  25% { transform: rotate(90deg) translateY(-8%); }
  50% { transform: rotate(180deg) translateY(0); }
  75% { transform: rotate(270deg) translateY(-8%); }
  100% { transform: rotate(360deg) translateY(0); }
}
</style>
