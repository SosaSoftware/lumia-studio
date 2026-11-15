<script setup lang="ts">
import { computed } from 'vue';
import { list, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useMotion } from './motion.ts';
import { splitLabel } from './render-helpers.ts';
import { toneVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const { live } = useMotion(props);
const items = computed(() => list(props.data.items).map((item) => splitLabel(str(item))));
const ordered = computed(() => props.data.ordered === true);
const marker = computed(() => str(props.data.marker, 'dot'));

const MARKERS: Readonly<Record<string, string>> = {
  check: 'M20 6 9 17l-5-5',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  star: 'M12 3l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 16.9 6.4 20l1.3-6.2L3 9.5l6.3-.7z',
};
</script>

<template>
  <component :is="ordered ? 'ol' : 'ul'" class="el-list" :data-variant="str(data.variant, 'cards')" :data-size="str(data.size, 'md')" :data-playing="live" :style="toneVars(data.color, 'primary')">
    <li v-for="(item, index) in items" :key="index" class="item" :style="{ animationDelay: `${index * 0.08}s` }">
      <span v-if="ordered" class="number" aria-hidden="true">{{ index + 1 }}</span>
      <span v-else class="bullet" :data-marker="marker" aria-hidden="true">
        <svg v-if="MARKERS[marker]" viewBox="0 0 24 24"><path :d="MARKERS[marker]" /></svg>
        <span v-else class="dot"></span>
      </span>
      <span class="text"><b v-if="item.label">{{ item.label }}</b>{{ item.label ? ' ' : '' }}{{ item.rest }}</span>
    </li>
  </component>
</template>

<style scoped>
.el-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1.1cqw; font-size: 1.9cqw; }
.el-list[data-size='sm'] { font-size: 1.55cqw; gap: 0.9cqw; }
.el-list[data-size='lg'] { font-size: 2.25cqw; }
.item { display: flex; align-items: center; gap: 0.8em; padding: 0.58em 0.85em; background: var(--sl-card); border: 0.12cqw solid var(--sl-line); border-radius: 1.2cqw; box-shadow: var(--sl-elev-1); }
[data-variant='plain'] { gap: 0.5cqw; }
[data-variant='plain'] .item { padding: 0.25em 0; background: transparent; border: 0; box-shadow: none; }
[data-playing='true'] .item { animation: sl-rise 0.4s ease-out both; }
.number, .bullet { width: 1.7em; height: 1.7em; flex: none; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
.number { background: var(--c-grad); color: var(--c-on); font-size: 0.8em; font-weight: 600; width: 2.1em; height: 2.1em; }
.bullet:not([data-marker='dot']) { background: var(--c-soft); color: var(--c-ink); }
.bullet svg { width: 58%; height: 58%; fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
.bullet[data-marker='star'] svg { fill: currentColor; stroke-width: 1; }
.dot { width: 0.55em; height: 0.55em; border-radius: 50%; background: var(--c); box-shadow: 0 0 0 0.22em var(--c-soft); }
.text { min-width: 0; line-height: 1.35; color: var(--sl-ink); overflow-wrap: anywhere; }
[data-variant='plain'] .text { color: var(--sl-fg); }
.text b { font-weight: 600; }
</style>
