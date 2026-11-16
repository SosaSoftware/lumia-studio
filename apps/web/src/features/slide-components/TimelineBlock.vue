<script setup lang="ts">
import { computed } from 'vue';
import { list, rec, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useMotion } from './motion.ts';
import { colorKey, toneVars, vividColor } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const { live } = useMotion(props);
const vertical = computed(() => str(props.data.orientation, 'horizontal') === 'vertical');
const events = computed(() =>
  list(props.data.events).map((item, index) => ({
    label: str(rec(item).label),
    description: str(rec(item).description),
    emoji: str(rec(item).emoji).trim(),
    tone: toneVars(props.data.colorful === false ? colorKey(props.data.color, 'primary') : vividColor(index)),
  })),
);
</script>

<template>
  <div class="el-timeline" :data-vertical="vertical" :data-animated="live && data.animated !== false" :style="toneVars(data.color, 'primary')" data-testid="timeline-component">
    <span class="line" aria-hidden="true"></span>
    <ol class="events" :style="vertical ? undefined : { gridTemplateColumns: `repeat(${Math.max(events.length, 1)}, 1fr)` }">
      <li v-for="(event, index) in events" :key="index" class="event" :style="{ ...event.tone, animationDelay: `${index * 0.12}s` }">
        <span class="label">{{ event.label }}</span>
        <span class="dot" :data-emoji="event.emoji !== ''" aria-hidden="true">{{ event.emoji }}</span>
        <span class="description">{{ event.description }}</span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.el-timeline { position: relative; }
.line { position: absolute; left: 4%; right: 4%; top: 3.6cqw; height: 0.4cqw; border-radius: 0.2cqw; background: var(--c-grad); opacity: 0.35; }
.events { position: relative; list-style: none; margin: 0; padding: 0; display: grid; gap: 1.6cqw; }
.event { display: flex; flex-direction: column; align-items: center; gap: 0.8cqw; text-align: center; min-width: 0; }
[data-animated='true'] .event { animation: sl-rise 0.45s ease-out both; }
.label { font-size: 1.5cqw; font-weight: 600; line-height: 1.6cqw; color: var(--c-ink); }
.dot { width: 2.6cqw; height: 2.6cqw; flex: none; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 0.5cqw solid var(--sl-card); background: var(--c); box-shadow: 0 0 0 0.25cqw var(--c), var(--sl-elev-1); font-size: 1.5cqw; line-height: 1; }
.dot[data-emoji='true'] { width: 3.8cqw; height: 3.8cqw; margin: -0.6cqw 0; border-width: 0.3cqw; background: var(--c-soft); font-size: 1.8cqw; }
.description { font-size: 1.45cqw; line-height: 1.4; color: var(--sl-fg); overflow-wrap: anywhere; }
[data-vertical='true'] .line { left: 1.1cqw; right: auto; top: 1.4cqw; bottom: 1.4cqw; width: 0.4cqw; height: auto; }
[data-vertical='true'] .events { grid-template-columns: 1fr; gap: 1.4cqw; }
[data-vertical='true'] .event { display: grid; grid-template-columns: 2.6cqw 1fr; grid-template-rows: auto auto; column-gap: 1.6cqw; row-gap: 0.3cqw; align-items: start; text-align: left; }
[data-vertical='true'] .dot { grid-column: 1; grid-row: 1 / span 2; }
[data-vertical='true'] .dot[data-emoji='true'] { margin: -0.6cqw -0.6cqw 0; }
[data-vertical='true'] .label { grid-column: 2; grid-row: 1; line-height: 1.3; }
[data-vertical='true'] .description { grid-column: 2; grid-row: 2; }
</style>
