<script setup lang="ts">
import { computed } from 'vue';
import { THEME_COLOR_KEYS } from '@lumia/packages/catalog';
import type { ThemeColorKey } from '@lumia/packages/catalog';
import { COLOR_LABELS } from '../slides/slide-style.ts';

const props = defineProps<{ modelValue: string; label: string; disabled?: boolean; testid?: string; soft?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: ThemeColorKey] }>();
const name = computed(() => Object.entries(COLOR_LABELS).find(([key]) => key === props.modelValue)?.[1] ?? props.modelValue);

function pick(key: ThemeColorKey): void {
  if (!props.disabled) emit('update:modelValue', key);
}

function onKeydown(event: KeyboardEvent, index: number): void {
  const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
  if (step === 0) return;
  event.preventDefault();
  const next = THEME_COLOR_KEYS[(index + step + THEME_COLOR_KEYS.length) % THEME_COLOR_KEYS.length];
  if (next !== undefined) pick(next);
}
</script>

<template>
  <div class="swatches" role="radiogroup" :aria-label="label" :data-testid="testid">
    <button
      v-for="(key, index) in THEME_COLOR_KEYS"
      :key="key"
      type="button"
      class="swatch"
      role="radio"
      :aria-checked="key === modelValue"
      :aria-label="COLOR_LABELS[key]"
      :title="COLOR_LABELS[key]"
      :tabindex="key === modelValue ? 0 : -1"
      :disabled="disabled"
      :style="{ background: soft ? `var(--sl-${key}-soft)` : `var(--sl-${key})` }"
      :data-testid="testid ? `${testid}-${key}` : undefined"
      @click="pick(key)"
      @keydown="onKeydown($event, index)"
    ></button>
    <span class="name">{{ name }}</span>
  </div>
</template>

<style scoped>
.swatches { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.swatch { width: 20px; height: 20px; padding: 0; border: 1px solid var(--s-border); border-radius: 50%; cursor: pointer; }
.swatch[aria-checked='true'] { box-shadow: 0 0 0 2px var(--s-panel), 0 0 0 4px var(--s-active); }
.swatch:disabled { cursor: not-allowed; opacity: 0.6; }
.swatch:focus-visible { outline: 2px solid var(--s-active); outline-offset: 3px; }
.name { margin-left: 4px; font-size: 12px; color: var(--s-text-2); }
</style>
