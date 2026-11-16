<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { prefersReducedMotion, useMotion } from './motion.ts';
import { toneVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const { live, ambient } = useMotion(props);
const text = computed(() => str(props.data.text));
/** Characters, not UTF-16 units, so an emoji is typed whole. */
const letters = computed(() => Array.from(text.value));
const shown = ref(letters.value.length);
const align = computed(() => str(props.data.align, 'left'));
let timer: ReturnType<typeof setTimeout> | null = null;

const DELAYS: Readonly<Record<string, number>> = { slow: 110, normal: 60, fast: 28 };

function stop(): void {
  if (timer !== null) clearTimeout(timer);
  timer = null;
}

function type(): void {
  stop();
  const total = letters.value.length;
  if (!live.value || prefersReducedMotion()) {
    shown.value = total;
    return;
  }
  const delay = DELAYS[str(props.data.speed, 'normal')] ?? 60;
  shown.value = 0;
  const tick = (): void => {
    if (shown.value < total) {
      shown.value += 1;
      timer = setTimeout(tick, delay);
    } else if (props.data.loop === true) {
      timer = setTimeout(type, 2200);
    }
  };
  timer = setTimeout(tick, 350);
}

watch([text, live, () => props.data.speed, () => props.data.loop], type, { immediate: true });
onBeforeUnmount(stop);
</script>

<template>
  <p
    class="el-typewriter"
    :data-size="str(data.size, 'lg')"
    :data-mono="data.mono === true"
    :aria-label="text"
    :style="{ ...toneVars(data.color, 'primary'), textAlign: align === 'center' || align === 'right' ? align : 'left' }"
    data-testid="typewriter"
  >
    <!-- The whole text keeps its space, so the frame does not grow while it is typed. -->
    <span aria-hidden="true">{{ letters.slice(0, shown).join('') }}</span><span v-if="data.cursor !== false" class="cursor" :data-blink="ambient" aria-hidden="true"></span><span class="rest" aria-hidden="true">{{ letters.slice(shown).join('') }}</span>
  </p>
</template>

<style scoped>
.el-typewriter { margin: 0; font-size: 2.2cqw; font-weight: 500; line-height: 1.4; color: var(--sl-fg); white-space: pre-line; overflow-wrap: anywhere; }
.el-typewriter[data-size='sm'] { font-size: 1.7cqw; }
.el-typewriter[data-size='lg'] { font-size: 2.9cqw; }
.el-typewriter[data-mono='true'] { font-family: var(--sl-font-mono); }
.cursor { display: inline-block; width: 0.12em; height: 1.05em; margin: 0 0.06em; vertical-align: text-bottom; border-radius: 0.06em; background: var(--c); }
.cursor[data-blink='true'] { animation: sl-blink 1s steps(1) infinite; }
.rest { visibility: hidden; }
</style>
