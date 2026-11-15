<script setup lang="ts">
import { computed } from 'vue';
import { list, num, rec, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useMotion } from './motion.ts';
import { colorKey, fillVars, vividColor } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const { live } = useMotion(props);
const columns = computed(() => Math.min(4, Math.max(1, Math.round(num(props.data.columns, 3)))));
const items = computed(() =>
  list(props.data.items).map((item, index) => ({
    emoji: str(rec(item).emoji).trim(),
    title: str(rec(item).title),
    text: str(rec(item).text),
    // A wide card cannot be wider than the grid.
    wide: rec(item).wide === true && columns.value > 1,
    tone: fillVars(props.data.colorful === true ? vividColor(index) : colorKey(props.data.color, 'primary'), props.data.variant ?? 'soft'),
  })),
);
</script>

<template>
  <ul class="el-content-grid" :data-animated="live && data.animated !== false" :style="{ gridTemplateColumns: `repeat(${columns}, 1fr)` }" data-testid="content-grid">
    <li v-for="(item, index) in items" :key="index" class="card" :data-wide="item.wide" :style="{ ...item.tone, animationDelay: `${index * 0.08}s` }">
      <span v-if="item.emoji" class="emoji" aria-hidden="true">{{ item.emoji }}</span>
      <span class="title">{{ item.title }}</span>
      <span v-if="item.text" class="text">{{ item.text }}</span>
    </li>
  </ul>
</template>

<style scoped>
.el-content-grid { list-style: none; margin: 0; padding: 0; width: 100%; height: 100%; display: grid; grid-auto-rows: 1fr; grid-auto-flow: dense; gap: 1.2cqw; }
.card { min-width: 0; min-height: 0; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5cqw; padding: 1.4cqw; border-radius: 1.4cqw; background: var(--fill); color: var(--fill-fg); border: 0.15cqw solid var(--fill-edge); text-align: center; box-shadow: var(--sl-elev-1); overflow: hidden; transition: transform 0.25s var(--sl-ease-bounce), box-shadow 0.25s ease; }
.card:hover { transform: translateY(-0.3cqw); box-shadow: var(--sl-elev-2); }
.card[data-wide='true'] { grid-column: span 2; }
[data-animated='true'] .card { animation: sl-zoom 0.45s var(--sl-ease-bounce) both; }
.emoji { font-size: 3.2cqw; line-height: 1; }
.title { font-size: 1.7cqw; font-weight: 600; line-height: 1.2; overflow-wrap: anywhere; }
.text { font-size: 1.3cqw; line-height: 1.35; opacity: 0.85; overflow-wrap: anywhere; }
</style>
