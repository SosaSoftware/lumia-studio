<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { list, num, rec, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { toneVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const steps = computed(() => list(props.data.steps).map((item) => ({ title: str(rec(item).title), description: str(rec(item).description) })));
const current = ref(0);
const clickable = computed(() => props.mode === 'student' && props.data.interactive !== false);

watch(
  () => [props.data.current, steps.value.length] as const,
  () => {
    current.value = Math.min(Math.max(0, Math.round(num(props.data.current, 1))), steps.value.length);
  },
  { immediate: true },
);

/** `done` before the current step, `current` on it and `todo` after it. */
function stateOf(index: number): 'done' | 'current' | 'todo' {
  const position = index + 1;
  return position < current.value ? 'done' : position === current.value ? 'current' : 'todo';
}
</script>

<template>
  <ol class="el-stepper" :data-orientation="str(data.orientation, 'horizontal')" :style="{ ...toneVars(data.color, 'primary'), '--count': String(Math.max(steps.length, 1)) }" data-testid="stepper">
    <li v-for="(step, index) in steps" :key="index" class="step" :data-state="stateOf(index)" :aria-current="stateOf(index) === 'current' ? 'step' : undefined">
      <span class="rail" aria-hidden="true"></span>
      <component
        :is="clickable ? 'button' : 'span'"
        :type="clickable ? 'button' : undefined"
        class="node"
        :aria-label="clickable ? `Ir al paso ${index + 1}: ${step.title}` : undefined"
        @click.stop="clickable && (current = index + 1)"
      >
        <svg v-if="stateOf(index) === 'done'" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
        <template v-else>{{ index + 1 }}</template>
      </component>
      <span class="copy">
        <span class="title">{{ step.title }}</span>
        <span v-if="step.description" class="description">{{ step.description }}</span>
      </span>
    </li>
  </ol>
</template>

<style scoped>
.el-stepper { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(var(--count), 1fr); }
.step { position: relative; display: flex; flex-direction: column; align-items: center; gap: 1cqw; padding: 0 0.8cqw; text-align: center; }
.rail { position: absolute; top: 2.1cqw; left: calc(-50% + 2.4cqw); right: calc(50% + 2.4cqw); height: 0.5cqw; border-radius: 99cqw; background: var(--sl-line-2); }
.step:first-child .rail { display: none; }
.step[data-state='done'] .rail, .step[data-state='current'] .rail { background: var(--c-grad); }
.node { position: relative; width: 4.2cqw; height: 4.2cqw; flex: none; box-sizing: border-box; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 0.3cqw solid var(--sl-line-2); background: var(--sl-card); color: var(--sl-ink-3); font: inherit; font-size: 1.7cqw; font-weight: 600; transition: transform 0.25s var(--sl-ease-bounce), background 0.2s, border-color 0.2s; }
button.node { cursor: pointer; }
button.node:hover { transform: scale(1.08); }
button.node:focus-visible { outline: 0.25cqw solid var(--c); outline-offset: 0.25cqw; }
.node svg { width: 52%; height: 52%; fill: none; stroke: currentColor; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.step[data-state='done'] .node { background: var(--c); border-color: var(--c); color: var(--c-on); }
.step[data-state='current'] .node { background: var(--c-grad); border-color: transparent; color: var(--c-on); transform: scale(1.12); box-shadow: 0 0 0 0.6cqw var(--c-soft); }
.copy { display: flex; flex-direction: column; gap: 0.3cqw; min-width: 0; }
.title { font-size: 1.7cqw; font-weight: 600; line-height: 1.25; color: var(--sl-fg); overflow-wrap: anywhere; }
.description { font-size: 1.35cqw; line-height: 1.35; color: var(--sl-fg-2); overflow-wrap: anywhere; }
.step[data-state='todo'] .title { color: var(--sl-fg-2); }
[data-orientation='vertical'] { grid-template-columns: 1fr; gap: 1.6cqw; }
[data-orientation='vertical'] .step { flex-direction: row; align-items: flex-start; gap: 1.6cqw; padding: 0; text-align: left; }
/* Vertical rails hang below each node, down to the next one, whatever the height of the text. */
[data-orientation='vertical'] .rail { display: block; top: 4.5cqw; bottom: -1.3cqw; left: 1.85cqw; right: auto; width: 0.5cqw; height: auto; }
[data-orientation='vertical'] .step:last-child .rail { display: none; }
[data-orientation='vertical'] .step[data-state='current'] .rail { background: var(--sl-line-2); }
[data-orientation='vertical'] .copy { padding-top: 0.5cqw; }
</style>
