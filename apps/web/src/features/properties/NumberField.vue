<script setup lang="ts">
import { inputNumber } from './controls.ts';

const props = defineProps<{
  modelValue: number;
  label: string;
  /** Short text before the number inside the box, e.g. "x". */
  prefix?: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  invalid?: boolean;
  testid?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: number] }>();

function onInput(event: Event): void {
  const value = inputNumber(event);
  if (value === null) return;
  const bounded = Math.min(Math.max(value, props.min ?? -Infinity), props.max ?? Infinity);
  emit('update:modelValue', bounded);
}
</script>

<template>
  <label class="pv number" :data-invalid="invalid === true">
    <span v-if="prefix" class="affix">{{ prefix }}</span>
    <input
      class="control"
      type="number"
      :value="Math.round(modelValue * 100) / 100"
      :min="min"
      :max="max"
      :step="step ?? 1"
      :aria-label="label"
      :aria-invalid="invalid === true"
      :disabled="disabled"
      :data-testid="testid"
      @input="onInput"
    />
    <span v-if="unit" class="affix">{{ unit }}</span>
  </label>
</template>

<style scoped>
.number { min-width: 0; padding-top: 0; padding-bottom: 0; cursor: text; }
.number:focus-within { border-color: var(--s-active); }
.number[data-invalid='true'] { border-color: var(--s-danger); }
.control { flex: 1; min-width: 0; height: 28px; padding: 0; background: transparent; border: 0; color: var(--s-text); font: inherit; font-size: 12px; font-variant-numeric: tabular-nums; outline: none; }
.control:disabled { color: var(--s-text-2); }
.affix { flex: none; color: var(--s-text-2); }
</style>
