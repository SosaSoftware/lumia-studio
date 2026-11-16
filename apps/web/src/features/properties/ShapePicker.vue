<script setup lang="ts">
import { computed } from 'vue';
import { pickerPath, SHAPE_ORDER } from '../slide-components/shape-outlines.ts';
import { valueLabel } from './prop-labels.ts';

/** Visual picker of the basic shapes: each option is the shape itself, as the slide draws it. */
const props = defineProps<{ modelValue: string; label: string; options: readonly string[]; disabled?: boolean; testid?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

/** Shapes of the picker in its order, plus the legacy ones the element may already have (line, arrow). */
const shapes = computed(() => {
  const known = SHAPE_ORDER.filter((kind) => props.options.includes(kind));
  return props.options.includes(props.modelValue) && !known.includes(props.modelValue) ? [...known, props.modelValue] : known;
});

function pick(kind: string): void {
  if (!props.disabled && kind !== props.modelValue) emit('update:modelValue', kind);
}

function onKeydown(event: KeyboardEvent, index: number): void {
  const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
  if (step === 0) return;
  event.preventDefault();
  const next = shapes.value[(index + step + shapes.value.length) % shapes.value.length];
  if (next === undefined) return;
  pick(next);
  const target = event.currentTarget;
  if (target instanceof HTMLElement) target.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]').item((index + step + shapes.value.length) % shapes.value.length).focus();
}
</script>

<template>
  <div class="shapes" role="radiogroup" :aria-label="label" :data-testid="testid">
    <button
      v-for="(kind, index) in shapes"
      :key="kind"
      type="button"
      class="shape"
      role="radio"
      :aria-checked="kind === modelValue"
      :aria-label="valueLabel('shape', 'kind', kind)"
      :title="valueLabel('shape', 'kind', kind)"
      :tabindex="kind === modelValue ? 0 : -1"
      :disabled="disabled"
      :data-testid="`${testid ?? 'shape'}-${kind}`"
      @click="pick(kind)"
      @keydown="onKeydown($event, index)"
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <path v-if="kind === 'line'" d="M6 50 H94" class="stroke" />
        <path v-else-if="kind === 'arrow'" d="M6 50 H88 M68 28 L92 50 L68 72" class="stroke" />
        <path v-else :d="pickerPath(kind)" class="solid" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.shapes { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; }
.shape { height: 34px; display: flex; align-items: center; justify-content: center; padding: 4px; background: var(--s-input); border: 1px solid var(--s-border); border-radius: 6px; color: var(--s-text-2); cursor: pointer; }
.shape:hover:not(:disabled) { border-color: var(--s-active); color: var(--s-text); }
.shape[aria-checked='true'] { border-color: var(--s-active); background: var(--s-active-soft); color: var(--s-text); }
.shape:focus-visible { outline: 2px solid var(--s-active); outline-offset: 1px; }
.shape:disabled { opacity: 0.5; cursor: not-allowed; }
svg { width: 100%; height: 100%; }
.solid { fill: currentColor; fill-opacity: 0.22; stroke: currentColor; stroke-width: 6; stroke-linejoin: round; }
.stroke { fill: none; stroke: currentColor; stroke-width: 7; stroke-linecap: round; stroke-linejoin: round; }
</style>
