<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { num, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { colorKey, fillVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const root = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const revealed = ref(false);
const student = computed(() => props.mode === 'student');
let drawing = false;
let observer: ResizeObserver | null = null;
let strokes = 0;
/** Last scratched point in canvas pixels, so fast moves leave a continuous trail. */
let last: { x: number; y: number } | null = null;

/** Brush radius as a share of the card's smaller side. */
const BRUSH: Readonly<Record<string, number>> = { sm: 0.07, md: 0.11, lg: 0.16 };

/** Paints the cover in canvas pixels; the color comes from the theme variables of the root. */
function paintCover(): void {
  const element = canvas.value;
  const host = root.value;
  if (element === null || host === null) return;
  const ratio = window.devicePixelRatio || 1;
  element.width = Math.max(1, Math.round(host.clientWidth * ratio));
  element.height = Math.max(1, Math.round(host.clientHeight * ratio));
  const context = element.getContext('2d');
  if (context === null) return;
  const style = getComputedStyle(host);
  const base = style.getPropertyValue('--cover').trim() || '#8F8D88';
  const gradient = context.createLinearGradient(0, 0, element.width, element.height);
  gradient.addColorStop(0, base);
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.55)');
  gradient.addColorStop(1, base);
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = base;
  context.fillRect(0, 0, element.width, element.height);
  context.globalAlpha = 0.35;
  context.fillStyle = gradient;
  context.fillRect(0, 0, element.width, element.height);
  context.globalAlpha = 1;
  // Sparkles make the cover read as something to scratch.
  context.fillStyle = 'rgba(255, 255, 255, 0.5)';
  for (let index = 0; index < 40; index += 1) {
    const x = ((index * 97) % 100) / 100;
    const y = ((index * 61) % 100) / 100;
    context.beginPath();
    context.arc(x * element.width, y * element.height, ratio * (1 + (index % 3)), 0, Math.PI * 2);
    context.fill();
  }
  const label = str(props.data.coverLabel).trim();
  if (label !== '') {
    context.fillStyle = 'rgba(255, 255, 255, 0.92)';
    context.font = `600 ${String(Math.round(element.height * 0.14))}px Lexend, system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(`✨ ${label} ✨`, element.width / 2, element.height / 2, element.width * 0.9);
  }
}

function scratchAt(event: PointerEvent): void {
  const element = canvas.value;
  const context = element?.getContext('2d') ?? null;
  if (element === null || context === null) return;
  const box = element.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) return;
  const x = ((event.clientX - box.left) / box.width) * element.width;
  const y = ((event.clientY - box.top) / box.height) * element.height;
  const radius = Math.min(element.width, element.height) * (BRUSH[str(props.data.brush, 'md')] ?? 0.11);
  context.globalCompositeOperation = 'destination-out';
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.lineWidth = radius * 2;
  context.beginPath();
  context.moveTo(last?.x ?? x, last?.y ?? y);
  context.lineTo(x, y);
  context.stroke();
  last = { x, y };
  strokes += 1;
  if (strokes % 6 === 0) checkProgress();
}

/** Samples the alpha channel; once enough of the cover is gone, the rest fades away. */
function checkProgress(): void {
  const element = canvas.value;
  const context = element?.getContext('2d', { willReadFrequently: true }) ?? null;
  if (element === null || context === null || revealed.value) return;
  const { data } = context.getImageData(0, 0, element.width, element.height);
  let clear = 0;
  let samples = 0;
  for (let index = 3; index < data.length; index += 4 * 40) {
    samples += 1;
    if ((data[index] ?? 255) < 40) clear += 1;
  }
  if (samples > 0 && (clear / samples) * 100 >= num(props.data.revealAt, 55)) reveal();
}

function reveal(): void {
  revealed.value = true;
}

function onDown(event: PointerEvent): void {
  if (!student.value || revealed.value) return;
  drawing = true;
  last = null;
  if (event.currentTarget instanceof HTMLElement) event.currentTarget.setPointerCapture(event.pointerId);
  scratchAt(event);
}

function onMove(event: PointerEvent): void {
  if (drawing) scratchAt(event);
}

function onUp(): void {
  drawing = false;
  last = null;
  checkProgress();
}

function reset(): void {
  revealed.value = false;
  strokes = 0;
  void nextTick(paintCover);
}

watch(() => [props.data.coverColor, props.data.coverLabel, props.mode] as const, reset);

onMounted(() => {
  paintCover();
  if (typeof ResizeObserver === 'function' && root.value !== null) {
    observer = new ResizeObserver(() => {
      if (!revealed.value) paintCover();
    });
    observer.observe(root.value);
  }
});
onBeforeUnmount(() => {
  observer?.disconnect();
});
</script>

<template>
  <div
    ref="root"
    class="el-scratch"
    :data-revealed="revealed"
    :data-live="student"
    :data-peek="mode === 'edit' && selected"
    :style="{ ...fillVars(data.color, 'gradient', 'purple'), '--cover': `var(--sl-${colorKey(data.coverColor, 'muted')})` }"
    data-testid="scratch-card"
  >
    <div class="prize" :aria-hidden="!revealed && student">
      <span class="emoji" aria-hidden="true">{{ str(data.emoji) }}</span>
      <span class="title">{{ str(data.title) }}</span>
      <span v-if="str(data.text)" class="text">{{ str(data.text) }}</span>
    </div>
    <canvas
      ref="canvas"
      class="cover"
      :aria-label="student && !revealed ? 'Raspa para descubrir el contenido' : undefined"
      :role="student && !revealed ? 'img' : undefined"
      @pointerdown.stop="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    ></canvas>
    <button v-if="student && !revealed" type="button" class="skip" @click.stop="reveal">Descubrir</button>
  </div>
</template>

<style scoped>
.el-scratch { position: relative; width: 100%; height: 100%; border-radius: 1.6cqw; overflow: hidden; box-shadow: var(--sl-elev-2); user-select: none; touch-action: none; }
.prize { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5cqw; padding: 1.6cqw; background: var(--fill); color: var(--fill-fg); text-align: center; }
.emoji { font-size: 4cqw; line-height: 1; }
[data-revealed='true'] .emoji { animation: sl-bounce 1s ease-in-out 2; }
.title { font-size: 2cqw; font-weight: 600; line-height: 1.2; }
.text { font-size: 1.4cqw; line-height: 1.4; opacity: 0.9; overflow-wrap: anywhere; }
.cover { position: absolute; inset: 0; width: 100%; height: 100%; transition: opacity 0.6s ease; }
[data-live='true'] .cover { cursor: crosshair; }
[data-revealed='true'] .cover { opacity: 0; pointer-events: none; }
/* While the author selects the card in the editor, the cover lets the hidden content show through. */
[data-peek='true'] .cover { opacity: 0.18; }
.skip { position: absolute; right: 1cqw; bottom: 1cqw; padding: 0.4cqw 1cqw; border: 0; border-radius: 99cqw; background: rgba(255, 255, 255, 0.85); color: var(--sl-ink); font: inherit; font-size: 1.1cqw; font-weight: 600; cursor: pointer; opacity: 0.75; }
.skip:hover, .skip:focus-visible { opacity: 1; }
.skip:focus-visible { outline: 0.25cqw solid var(--c); outline-offset: 0.2cqw; }
</style>
