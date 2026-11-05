<script setup lang="ts">
import { computed } from 'vue';
import { str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useSlideContext } from './slide-context.ts';

const props = defineProps<CatalogComponentProps>();
const context = useSlideContext();
const action = computed(() => str(props.data.action, 'next_slide'));
const target = computed(() => str(props.data.target).trim());
const external = computed(() => action.value === 'open_url');

function run(): void {
  const navigator = context.navigator;
  if (action.value === 'open_url') {
    if (/^https?:\/\//i.test(target.value)) window.open(target.value, '_blank', 'noopener,noreferrer');
    return;
  }
  if (navigator === null) return;
  if (action.value === 'go_to_slide') {
    const position = Number(target.value);
    if (Number.isInteger(position) && position >= 1) navigator.goTo(position);
    return;
  }
  navigator.next();
}
</script>

<template>
  <button v-if="mode === 'student'" type="button" class="el-button" data-testid="button-link" @click.stop="run">
    <span class="label">{{ str(data.label) }}</span>
    <svg v-if="external" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3h7v7M21 3l-9 9M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" /></svg>
    <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  </button>
  <div v-else class="el-button" data-testid="button-link">
    <span class="label">{{ str(data.label) }}</span>
    <svg v-if="external" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3h7v7M21 3l-9 9M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" /></svg>
    <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  </div>
</template>

<style scoped>
.el-button { width: 100%; height: 100%; box-sizing: border-box; display: flex; align-items: center; justify-content: center; gap: 1cqw; padding: 0 1.6cqw; border-radius: 99cqw; background: var(--sl-blue); color: var(--sl-white); border: 0; font: inherit; font-size: 1.7cqw; font-weight: 600; white-space: nowrap; overflow: hidden; }
button.el-button { cursor: pointer; }
button.el-button:hover { filter: brightness(1.08); }
button.el-button:focus-visible { outline: 0.25cqw solid var(--sl-blue); outline-offset: 0.3cqw; }
.label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
svg { width: 2cqw; height: 2cqw; flex: none; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
</style>
