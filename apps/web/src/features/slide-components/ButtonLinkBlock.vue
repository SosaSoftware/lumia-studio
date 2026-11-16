<script setup lang="ts">
import { computed, ref } from 'vue';
import { str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useMotion } from './motion.ts';
import { useSlideContext } from './slide-context.ts';
import { toneVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const context = useSlideContext();
const action = computed(() => str(props.data.action, 'next_slide'));
const target = computed(() => str(props.data.target).trim());
const external = computed(() => action.value === 'open_url');
const { ambient } = useMotion(props);
const emoji = computed(() => str(props.data.emoji).trim());
/** A start button turns off once it has started its slide: the slide starts only once. */
const used = ref(false);

function run(): void {
  const navigator = context.navigator;
  if (action.value === 'open_url') {
    if (/^https?:\/\//i.test(target.value)) window.open(target.value, '_blank', 'noopener,noreferrer');
    return;
  }
  if (navigator === null) return;
  if (action.value === 'start_slide') {
    if (navigator.start(props.elementId)) used.value = true;
    return;
  }
  if (action.value === 'go_to_slide') {
    const position = Number(target.value);
    if (Number.isInteger(position) && position >= 1) navigator.goTo(position, props.elementId);
    return;
  }
  navigator.next(props.elementId);
}
</script>

<template>
  <component
    :is="mode === 'student' ? 'button' : 'div'"
    :type="mode === 'student' ? 'button' : undefined"
    class="el-button"
    :data-variant="str(data.variant, 'gradient')"
    :data-shape="str(data.shape, 'pill')"
    :data-pulse="ambient && data.pulse === true"
    :style="toneVars(data.color, 'primary')"
    :disabled="mode === 'student' && used ? true : undefined"
    data-testid="button-link"
    @click.stop="mode === 'student' && run()"
  >
    <span v-if="emoji" class="emoji" aria-hidden="true">{{ emoji }}</span>
    <span class="label">{{ str(data.label) }}</span>
    <svg v-if="external" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3h7v7M21 3l-9 9M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" /></svg>
    <svg v-else viewBox="0 0 24 24" aria-hidden="true" class="go"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  </component>
</template>

<style scoped>
.el-button { position: relative; width: 100%; height: 100%; box-sizing: border-box; display: flex; align-items: center; justify-content: center; gap: 1cqw; padding: 0 1.8cqw; border-radius: 1.2cqw; background: var(--c-grad); color: var(--c-on); border: 0.2cqw solid transparent; font: inherit; font-size: 1.7cqw; font-weight: 600; white-space: nowrap; box-shadow: 0 0.5cqw 1.2cqw color-mix(in srgb, var(--c) 30%, transparent); transition: transform 0.2s var(--sl-ease-bounce), box-shadow 0.2s ease, filter 0.2s ease; }
.el-button[data-shape='pill'] { border-radius: 99cqw; }
.el-button[data-variant='solid'] { background: var(--c); }
.el-button[data-variant='soft'] { background: var(--c-soft); color: var(--c-ink); box-shadow: none; }
.el-button[data-variant='outline'] { background: var(--sl-card); color: var(--c-ink); border-color: var(--c); box-shadow: none; }
button.el-button { cursor: pointer; }
button.el-button:disabled { cursor: default; opacity: 0.5; filter: grayscale(0.4); box-shadow: none; transform: none; }
button.el-button:not(:disabled):hover { transform: translateY(-0.2cqw); filter: brightness(1.06); }
button.el-button:not(:disabled):hover .go { transform: translateX(0.4cqw); }
button.el-button:active { transform: translateY(0) scale(0.97); }
button.el-button:focus-visible { outline: 0.25cqw solid var(--c); outline-offset: 0.3cqw; }
.el-button[data-pulse='true']::after { content: ''; position: absolute; inset: -0.2cqw; border-radius: inherit; border: 0.3cqw solid var(--c); animation: sl-ring 1.8s ease-out infinite; pointer-events: none; }
.emoji { flex: none; font-size: 1.15em; line-height: 1; }
.label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
svg { width: 2cqw; height: 2cqw; flex: none; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; transition: transform 0.2s ease; }
</style>
