<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { list, rec, str } from '../../api/decode.ts';
import { burstConfetti } from './confetti.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useCompletion } from './motion.ts';
import { seededShuffle } from './render-helpers.ts';
import { toneVars } from './tone.ts';

interface MemoryCard {
  /** Position in the shuffled deck, unique. */
  id: number;
  pair: number;
  content: string;
}

const props = defineProps<CatalogComponentProps>();
const root = ref<HTMLElement | null>(null);
const student = computed(() => props.mode === 'student');
const report = useCompletion(() => props.elementId);
const pairs = computed(() => list(props.data.pairs).map((item) => ({ front: str(rec(item).front), match: str(rec(item).match) })));

/** Both cards of every pair, in an order seeded by the content so every render deals the same board. */
const deck = computed<MemoryCard[]>(() => {
  const cards = pairs.value.flatMap((pair, index) => [
    { pair: index, content: pair.front },
    { pair: index, content: pair.match },
  ]);
  const order = student.value ? seededShuffle(cards, `${props.elementId}${pairs.value.map((pair) => pair.front).join('|')}`, true) : cards;
  return order.map((card, id) => ({ ...card, id }));
});
const columns = computed(() => {
  const count = deck.value.length;
  return count <= 4 ? count : count <= 6 ? 3 : count <= 12 ? 4 : count <= 15 ? 5 : 4;
});

const open = ref<number[]>([]);
const matched = ref(new Set<number>());
const moves = ref(0);
const busy = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;
const won = computed(() => pairs.value.length > 0 && matched.value.size === pairs.value.length);

function reset(): void {
  if (timer !== null) clearTimeout(timer);
  open.value = [];
  matched.value = new Set();
  moves.value = 0;
  busy.value = false;
  report(false);
}

watch(() => [props.data, props.mode] as const, reset, { immediate: true });
onBeforeUnmount(() => {
  if (timer !== null) clearTimeout(timer);
});

function flip(card: MemoryCard): void {
  if (!student.value || busy.value || won.value || matched.value.has(card.pair) || open.value.includes(card.id)) return;
  open.value = [...open.value, card.id];
  if (open.value.length < 2) return;
  moves.value += 1;
  const [first, second] = open.value.map((id) => deck.value[id]);
  if (first !== undefined && first.pair === second?.pair) {
    matched.value = new Set([...matched.value, first.pair]);
    open.value = [];
    // Read the size again: `won` was false when the turn started.
    if (matched.value.size === pairs.value.length) {
      report(true);
      if (props.data.confetti !== false) burstConfetti(root.value, 'high');
    }
    return;
  }
  busy.value = true;
  timer = setTimeout(() => {
    open.value = [];
    busy.value = false;
  }, 900);
}

/** Face up: matched, open, or every card in the editor so the author sees the board. */
function faceUp(card: MemoryCard): boolean {
  return !student.value || matched.value.has(card.pair) || open.value.includes(card.id);
}

const symbol = computed(() => str(props.data.backSymbol).trim());
</script>

<template>
  <div ref="root" class="el-memory" :style="toneVars(data.color, 'purple')" data-testid="memory">
    <div class="board" :style="{ gridTemplateColumns: `repeat(${columns}, 1fr)` }">
      <component
        :is="student ? 'button' : 'div'"
        v-for="card in deck"
        :key="card.id"
        :type="student ? 'button' : undefined"
        class="card"
        :data-up="faceUp(card)"
        :data-matched="matched.has(card.pair)"
        :aria-label="student ? (faceUp(card) ? card.content : 'Tarjeta boca abajo') : undefined"
        :disabled="student ? matched.has(card.pair) : undefined"
        @click.stop="flip(card)"
      >
        <span class="inner" aria-hidden="true">
          <span class="face back-face">{{ symbol }}</span>
          <span class="face front-face" :data-long="card.content.length > 3">{{ card.content }}</span>
        </span>
      </component>
    </div>
    <div class="status">
      <span v-if="data.showMoves !== false" class="moves">Intentos: {{ moves }}</span>
      <span v-if="won" class="win" role="status">{{ str(data.feedbackCorrect) }}</span>
      <span v-else class="progress">{{ matched.size }} / {{ pairs.length }} parejas</span>
      <button v-if="student && (won || moves > 0)" type="button" class="again" @click.stop="reset">Jugar de nuevo</button>
    </div>
  </div>
</template>

<style scoped>
.el-memory { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; gap: 1cqw; }
.board { flex: 1; min-height: 0; display: grid; grid-auto-rows: 1fr; gap: 1cqw; }
/* Cards keep a near-square shape: the row sets the height and the width follows it, centered in its cell. */
.card { height: 100%; max-width: 100%; aspect-ratio: 1 / 1.1; justify-self: center; min-width: 0; min-height: 0; padding: 0; border: 0; background: transparent; font: inherit; perspective: 60cqw; }
button.card { cursor: pointer; }
button.card:focus-visible { outline: 0.25cqw solid var(--c); outline-offset: 0.2cqw; border-radius: 1.2cqw; }
.inner { position: relative; display: block; width: 100%; height: 100%; transform-style: preserve-3d; transition: transform 0.45s var(--sl-ease-bounce); }
.card[data-up='true'] .inner { transform: rotateY(180deg); }
button.card[data-up='false']:hover .inner { transform: rotateY(12deg); }
.face { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; border-radius: 1.2cqw; backface-visibility: hidden; -webkit-backface-visibility: hidden; box-shadow: var(--sl-elev-1); }
.back-face { background: var(--c-grad); color: var(--c-on); font-size: 3cqw; font-weight: 600; background-image: var(--c-grad), radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.2) 0 12%, transparent 13%); }
.front-face { transform: rotateY(180deg); background: var(--sl-card); border: 0.2cqw solid var(--c-soft); color: var(--sl-ink); font-size: 3.4cqw; line-height: 1.1; text-align: center; padding: 0.4cqw; overflow-wrap: anywhere; }
.front-face[data-long='true'] { font-size: 1.5cqw; font-weight: 600; }
.card[data-matched='true'] .front-face { border-color: var(--sl-success); background: var(--sl-success-soft); animation: sl-correct 0.5s var(--sl-ease-bounce); }
.status { flex: none; display: flex; align-items: center; gap: 1.4cqw; font-size: 1.35cqw; color: var(--sl-fg-2); }
.win { font-weight: 600; color: var(--sl-success-ink); animation: sl-zoom 0.4s var(--sl-ease-bounce) both; }
.again { margin-left: auto; padding: 0.5cqw 1.4cqw; border: 0; border-radius: 99cqw; background: var(--c-soft); color: var(--c-ink); font: inherit; font-size: 1.25cqw; font-weight: 600; cursor: pointer; }
.again:focus-visible { outline: 0.25cqw solid var(--c); outline-offset: 0.2cqw; }
</style>
