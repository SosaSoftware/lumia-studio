<script setup lang="ts" generic="T extends string | boolean">
import type { ChipOption } from './controls.ts';

const props = defineProps<{ options: readonly ChipOption<T>[]; modelValue: T | null; label: string; disabled?: boolean; testid?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: T] }>();

function pick(value: T): void {
  const option = props.options.find((candidate) => candidate.value === value);
  if (!props.disabled && option?.disabled !== true && value !== props.modelValue) emit('update:modelValue', value);
}

function onKeydown(event: KeyboardEvent, index: number): void {
  const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
  if (step === 0) return;
  event.preventDefault();
  const next = props.options[(index + step + props.options.length) % props.options.length];
  if (next === undefined || next.disabled === true) return;
  pick(next.value);
  const target = event.currentTarget;
  if (target instanceof HTMLElement) {
    const siblings = target.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]');
    siblings?.item((index + step + props.options.length) % props.options.length).focus();
  }
}
</script>

<template>
  <div class="chips" role="radiogroup" :aria-label="label" :aria-disabled="disabled === true" :data-testid="testid">
    <button
      v-for="(option, index) in options"
      :key="String(option.value)"
      type="button"
      class="pc chip"
      role="radio"
      :aria-checked="option.value === modelValue"
      :tabindex="option.value === modelValue || (modelValue === null && index === 0) ? 0 : -1"
      :disabled="disabled === true || option.disabled === true"
      :title="option.hint"
      :data-testid="testid ? `${testid}-${String(option.value)}` : undefined"
      @click="pick(option.value)"
      @keydown="onKeydown($event, index)"
    >{{ option.label }}</button>
  </div>
</template>

<style scoped>
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { background: transparent; border-color: var(--s-border); color: var(--s-text-2); font: inherit; font-size: 12px; cursor: pointer; }
.chip:hover:not(:disabled) { border-color: var(--s-text-2); color: var(--s-text); }
.chip[aria-checked='true'] { background: var(--s-active-soft); border-color: var(--s-active); color: var(--s-text); }
.chip:disabled { cursor: not-allowed; opacity: 0.6; }
.chip:focus-visible { outline: 2px solid var(--s-active); outline-offset: 1px; }
</style>
