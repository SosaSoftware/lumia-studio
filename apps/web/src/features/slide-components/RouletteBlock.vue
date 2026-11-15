<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { list, num, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { prefersReducedMotion } from './motion.ts';
import { colorKey, toneVars, vividColor } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const options = computed(() => list(props.data.options).map((item) => str(item)).filter((item) => item !== ''));
const student = computed(() => props.mode === 'student');
const rotation = ref(0);
const spinning = ref(false);
const result = ref<string | null>(null);
const duration = computed(() => (prefersReducedMotion() ? 0.01 : Math.min(10, Math.max(1, num(props.data.spinS, 4)))));
let timer: ReturnType<typeof setTimeout> | null = null;

/** Wedge colors: every option its own color, or two tones of the main color in turn. */
const wedges = computed(() => {
  const count = Math.max(1, options.value.length);
  const main = colorKey(props.data.color, 'primary');
  return options.value.map((label, index) => {
    const start = (index / count) * 360;
    const color = props.data.colorful === false ? (index % 2 === 0 ? `var(--sl-${main})` : `color-mix(in srgb, var(--sl-${main}) 55%, var(--sl-white))`) : `var(--sl-${vividColor(index)})`;
    return { label, start, end: start + 360 / count, middle: start + 180 / count, color };
  });
});
const background = computed(() => `conic-gradient(${wedges.value.map((wedge) => `${wedge.color} ${String(wedge.start)}deg ${String(wedge.end)}deg`).join(', ')})`);

watch(options, () => {
  result.value = null;
  rotation.value = 0;
});

/**
 * Picks the winner first and turns the wheel so that wedge stops under the pointer, at the top. The wheel turns
 * clockwise, so the winner's middle angle must end at 0°.
 */
function spin(): void {
  if (!student.value || spinning.value || options.value.length === 0) return;
  const winner = Math.floor(Math.random() * options.value.length);
  const wedge = wedges.value[winner];
  if (wedge === undefined) return;
  const jitter = (Math.random() - 0.5) * (360 / options.value.length) * 0.6;
  const current = ((rotation.value % 360) + 360) % 360;
  const target = (360 - wedge.middle + jitter + 360) % 360;
  rotation.value += 360 * 5 + ((target - current + 360) % 360);
  spinning.value = true;
  result.value = null;
  timer = setTimeout(() => {
    spinning.value = false;
    result.value = wedge.label;
  }, duration.value * 1000);
}

onBeforeUnmount(() => {
  if (timer !== null) clearTimeout(timer);
});
</script>

<template>
  <div class="el-roulette" :style="toneVars(data.color, 'primary')" data-testid="roulette">
    <div class="stage">
      <div class="square">
        <span class="pointer" aria-hidden="true"></span>
        <div class="wheel" :style="{ background, transform: `rotate(${rotation}deg)`, transitionDuration: `${duration}s` }" role="img" :aria-label="`Ruleta con ${options.join(', ')}`">
          <span v-for="(wedge, index) in wedges" :key="index" class="wedge-label" :style="{ transform: `rotate(${wedge.middle}deg)` }" aria-hidden="true">
            <span :data-long="wedge.label.length > 9">{{ wedge.label }}</span>
          </span>
          <span class="hub" aria-hidden="true"></span>
        </div>
      </div>
    </div>
    <div class="foot">
      <button v-if="student" type="button" class="spin" :disabled="spinning" data-testid="roulette-spin" @click.stop="spin">🎲 {{ str(data.buttonLabel, 'Girar') }}</button>
      <span v-else class="spin" aria-hidden="true">🎲 {{ str(data.buttonLabel, 'Girar') }}</span>
      <span :key="result ?? 'none'" class="result" role="status">{{ result ? `¡${result}!` : '' }}</span>
    </div>
  </div>
</template>

<style scoped>
.el-roulette { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; gap: 1cqw; }
/* The stage takes the free height; the wheel is the largest square inside it, so its parts use container units. */
.stage { flex: 1; min-height: 0; width: 100%; container-type: size; display: flex; align-items: center; justify-content: center; }
.square { position: relative; width: 100cqmin; height: 100cqmin; display: flex; align-items: center; justify-content: center; }
.wheel { position: relative; width: 92%; height: 92%; border-radius: 50%; border: 2cqmin solid var(--sl-card); box-shadow: 0 0 0 1cqmin var(--sl-line-2), 0 3cqmin 8cqmin rgba(22, 22, 22, 0.18); transition-property: transform; transition-timing-function: cubic-bezier(0.17, 0.67, 0.12, 0.99); overflow: hidden; }
.wedge-label { position: absolute; left: 50%; top: 0; width: 0; height: 50%; transform-origin: bottom center; display: flex; justify-content: center; }
.wedge-label > span { margin-top: 12%; writing-mode: vertical-rl; transform: rotate(180deg); max-height: 70%; font-size: 5.6cqmin; font-weight: 600; color: var(--sl-white); text-shadow: 0 0.3cqmin 1cqmin rgba(0, 0, 0, 0.35); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wedge-label > span[data-long='true'] { font-size: 4.4cqmin; }
.hub { position: absolute; left: 50%; top: 50%; width: 16%; height: 16%; transform: translate(-50%, -50%); border-radius: 50%; background: var(--sl-card); box-shadow: inset 0 0 0 1.4cqmin var(--c), 0 1cqmin 3cqmin rgba(22, 22, 22, 0.2); }
.pointer { position: absolute; top: 0; left: 50%; z-index: 1; width: 0; height: 0; transform: translateX(-50%); border-left: 5cqmin solid transparent; border-right: 5cqmin solid transparent; border-top: 8.5cqmin solid var(--sl-ink); filter: drop-shadow(0 0.6cqmin 1cqmin rgba(0, 0, 0, 0.3)); }
.foot { flex: none; display: flex; flex-direction: column; align-items: center; gap: 0.5cqw; }
.spin { padding: 0.8cqw 2.2cqw; border: 0; border-radius: 99cqw; background: var(--c-grad); color: var(--c-on); font: inherit; font-size: 1.5cqw; font-weight: 600; box-shadow: 0 0.4cqw 1cqw color-mix(in srgb, var(--c) 35%, transparent); }
button.spin { cursor: pointer; transition: transform 0.2s var(--sl-ease-bounce); }
button.spin:hover:not(:disabled) { transform: scale(1.05); }
button.spin:disabled { opacity: 0.6; cursor: progress; }
button.spin:focus-visible { outline: 0.25cqw solid var(--c); outline-offset: 0.3cqw; }
.result { min-height: 2cqw; font-size: 1.7cqw; font-weight: 600; color: var(--c-ink); animation: sl-zoom 0.4s var(--sl-ease-bounce) both; }
</style>
