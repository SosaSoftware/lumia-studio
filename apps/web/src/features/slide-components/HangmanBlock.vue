<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { num, str } from '../../api/decode.ts';
import { burstConfetti } from './confetti.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useCompletion } from './motion.ts';
import { toneVars, vividColor } from './tone.ts';
import { normalizeWord } from './word-search-grid.ts';

const props = defineProps<CatalogComponentProps>();
const root = ref<HTMLElement | null>(null);
const student = computed(() => props.mode === 'student');
const report = useCompletion(() => props.elementId);
const KEYS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');

/** The word as written, letter by letter, with the plain letter each one is guessed by. */
const letters = computed(() => Array.from(str(props.data.word).trim()).map((char) => ({ char, key: char === ' ' ? ' ' : normalizeWord(char) })));
const needed = computed(() => new Set(letters.value.map((letter) => letter.key).filter((key) => key !== ' ' && key !== '')));
const maxMistakes = computed(() => Math.min(8, Math.max(3, Math.round(num(props.data.maxMistakes, 6)))));
const guessed = ref(new Set<string>());
const mistakes = computed(() => [...guessed.value].filter((key) => !needed.value.has(key)).length);
const won = computed(() => needed.value.size > 0 && [...needed.value].every((key) => guessed.value.has(key)));
const lost = computed(() => !won.value && mistakes.value >= maxMistakes.value);
const over = computed(() => won.value || lost.value);
const balloons = computed(() => str(props.data.style, 'balloons') === 'balloons');

function reset(): void {
  guessed.value = new Set();
  report(false);
}

watch(() => [props.data, props.mode] as const, reset, { immediate: true });

function guess(key: string): void {
  if (!student.value || over.value || guessed.value.has(key)) return;
  guessed.value = new Set([...guessed.value, key]);
  // A guessed key becomes disabled and drops the focus; keeping it on the game lets the person go on typing.
  root.value?.focus({ preventScroll: true });
  if (won.value) {
    report(true);
    if (props.data.confetti !== false) burstConfetti(root.value, 'high');
  } else if (lost.value) {
    report(true);
  }
}

function onKeydown(event: KeyboardEvent): void {
  const key = normalizeWord(event.key);
  if (key.length === 1 && KEYS.includes(key)) {
    event.preventDefault();
    guess(key);
  }
}

/** A letter shows when guessed, when the game is over, and always in the editor. */
function shown(key: string): boolean {
  return !student.value || over.value || guessed.value.has(key);
}

/** Parts of the classic drawing, revealed one per mistake; the gallows is always drawn. */
const PARTS = ['M60 22 v10', 'M60 42 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0', 'M60 52 v26', 'M60 58 l-14 12', 'M60 58 l14 12', 'M60 78 l-12 18', 'M60 78 l12 18', 'M52 40 h2 M66 40 h2'];
const visibleParts = computed(() => {
  const total = maxMistakes.value;
  // Fewer allowed mistakes reveal several parts at once, so the drawing is always complete at the end.
  const count = Math.round((mistakes.value / total) * PARTS.length);
  return PARTS.slice(0, count);
});
</script>

<template>
  <div ref="root" class="el-hangman" :data-over="over" :data-won="won" :data-lost="lost" :style="toneVars(data.color, 'primary')" :tabindex="student ? 0 : -1" data-testid="hangman" @keydown="onKeydown">
    <div class="art" aria-hidden="true">
      <template v-if="balloons">
        <span class="basket">🧺</span>
        <span v-for="index in maxMistakes" :key="index" class="balloon" :data-popped="index <= mistakes" :style="{ ...toneVars(vividColor(index - 1)), '--i': String(index - 1), '--n': String(maxMistakes) }">
          <span class="string"></span>
        </span>
      </template>
      <svg v-else viewBox="0 0 100 110" class="gallows">
        <path d="M10 104 h50 M25 104 V6 h35 v16" class="frame" />
        <path v-for="(part, index) in visibleParts" :key="index" :d="part" class="part" />
      </svg>
    </div>
    <div class="play">
      <span v-if="str(data.hint)" class="hint">💡 {{ str(data.hint) }}</span>
      <div class="word" :aria-label="over || !student ? `Palabra: ${str(data.word)}` : `Palabra de ${letters.length} letras`">
        <span v-for="(letter, index) in letters" :key="index" class="slot" :data-space="letter.key === ' '" :data-shown="shown(letter.key)" :data-missed="lost && !guessed.has(letter.key)">
          <span class="char">{{ letter.key === ' ' ? '' : shown(letter.key) ? letter.char.toLocaleUpperCase('es') : '' }}</span>
        </span>
      </div>
      <div class="keyboard">
        <component
          :is="student ? 'button' : 'span'"
          v-for="key in KEYS"
          :key="key"
          :type="student ? 'button' : undefined"
          class="key"
          :data-state="guessed.has(key) ? (needed.has(key) ? 'hit' : 'miss') : 'idle'"
          :disabled="student ? guessed.has(key) || over : undefined"
          @click.stop="guess(key)"
        >{{ key }}</component>
      </div>
      <div class="status" role="status">
        <span v-if="won" class="result win">{{ str(data.feedbackCorrect) }}</span>
        <span v-else-if="lost" class="result lose">{{ str(data.feedbackIncorrect) }}</span>
        <span v-else class="mistakes">Errores: {{ mistakes }} / {{ maxMistakes }}</span>
        <button v-if="student && (over || guessed.size > 0)" type="button" class="again" @click.stop="reset">Jugar de nuevo</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.el-hangman { position: relative; width: 100%; height: 100%; display: flex; gap: 2.4cqw; outline: none; }
.el-hangman:focus-visible { outline: 0.2cqw dashed var(--c); outline-offset: 0.6cqw; border-radius: 1cqw; }
.art { position: relative; width: 30%; flex: none; display: flex; align-items: center; justify-content: center; }
.basket { position: absolute; left: 50%; bottom: 4%; transform: translateX(-50%); font-size: 4.4cqw; line-height: 1; }
[data-lost='true'] .basket { animation: hangman-fall 0.8s ease-in both; }
[data-won='true'] .basket, [data-won='true'] .balloon { animation: hangman-rise 1.6s ease-in-out infinite alternate; }
.balloon { position: absolute; left: calc(50% + (var(--i) - (var(--n) - 1) / 2) * 3.2cqw); bottom: calc(26% + (var(--i) % 2) * 3cqw); width: 3.4cqw; height: 4.2cqw; transform: translateX(-50%); border-radius: 50% 50% 48% 48% / 55% 55% 45% 45%; background: radial-gradient(circle at 32% 30%, rgba(255, 255, 255, 0.55) 0 14%, transparent 15%), var(--c); box-shadow: inset -0.4cqw -0.5cqw 0 rgba(0, 0, 0, 0.12); transition: transform 0.3s ease, opacity 0.3s ease; }
.string { position: absolute; left: 50%; top: 100%; width: 0.12cqw; height: calc(4cqw + (var(--i) % 2) * 3cqw); background: var(--sl-ink-4); }
.balloon[data-popped='true'] { opacity: 0; transform: translateX(-50%) scale(1.6); }
.gallows { width: 100%; height: 100%; }
.frame, .part { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.frame { stroke: var(--sl-ink-3); stroke-width: 3.5; }
.part { stroke: var(--sl-danger); stroke-width: 3; animation: sl-rise 0.3s ease-out both; }
.play { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 1.2cqw; }
.hint { font-size: 1.4cqw; line-height: 1.35; color: var(--sl-fg-2); }
.word { display: flex; flex-wrap: wrap; gap: 0.5cqw; }
.slot { width: 3cqw; height: 3.8cqw; display: flex; align-items: center; justify-content: center; border-bottom: 0.35cqw solid var(--c); font-size: 2.3cqw; font-weight: 600; color: var(--sl-fg); }
.slot[data-space='true'] { width: 1.6cqw; border-bottom-color: transparent; }
.slot[data-shown='true'] .char { animation: sl-zoom 0.3s var(--sl-ease-bounce) both; }
.slot[data-missed='true'] { color: var(--sl-danger-ink); }
.keyboard { display: grid; grid-template-columns: repeat(9, 1fr); gap: 0.45cqw; }
.key { padding: 0.55cqw 0; border: 0.12cqw solid var(--sl-line); border-radius: 0.7cqw; background: var(--sl-card); color: var(--sl-ink); font: inherit; font-size: 1.3cqw; font-weight: 600; text-align: center; box-shadow: 0 0.15cqw 0 var(--sl-line-2); }
button.key { cursor: pointer; transition: transform 0.15s ease; }
button.key:not(:disabled):hover { transform: translateY(-0.12cqw); border-color: var(--c); }
button.key:focus-visible { outline: 0.25cqw solid var(--c); outline-offset: 0.1cqw; }
.key[data-state='hit'] { background: var(--sl-success); border-color: var(--sl-success); color: var(--sl-on-success); }
.key[data-state='miss'] { background: var(--sl-muted-soft); color: var(--sl-ink-4); text-decoration: line-through; box-shadow: none; }
.status { display: flex; align-items: center; gap: 1.2cqw; min-height: 2.4cqw; font-size: 1.35cqw; color: var(--sl-fg-2); }
.result { font-weight: 600; animation: sl-zoom 0.4s var(--sl-ease-bounce) both; }
.win { color: var(--sl-success-ink); }
.lose { color: var(--sl-danger-ink); }
.again { margin-left: auto; padding: 0.5cqw 1.4cqw; border: 0; border-radius: 99cqw; background: var(--c-soft); color: var(--c-ink); font: inherit; font-size: 1.25cqw; font-weight: 600; cursor: pointer; }

@keyframes hangman-rise {
  from { translate: 0 0; }
  to { translate: 0 -0.8cqw; }
}

@keyframes hangman-fall {
  to { transform: translate(-50%, 20%) rotate(12deg); opacity: 0.5; }
}
</style>
