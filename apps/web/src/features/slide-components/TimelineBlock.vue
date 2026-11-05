<script setup lang="ts">
import { computed } from 'vue';
import { list, rec, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';

const props = defineProps<CatalogComponentProps>();
const events = computed(() => list(props.data.events).map((item) => ({ label: str(rec(item).label), description: str(rec(item).description) })));
</script>

<template>
  <div class="el-timeline" data-testid="timeline-component">
    <span class="line" aria-hidden="true"></span>
    <ol class="events" :style="{ gridTemplateColumns: `repeat(${Math.max(events.length, 1)}, 1fr)` }">
      <li v-for="(event, index) in events" :key="index" class="event">
        <span class="label">{{ event.label }}</span>
        <span class="dot" aria-hidden="true" :style="{ background: index % 2 === 0 ? 'var(--sl-blue)' : 'var(--sl-cyan)', boxShadow: `0 0 0 0.25cqw ${index % 2 === 0 ? 'var(--sl-blue)' : 'var(--sl-cyan)'}` }"></span>
        <span class="description">{{ event.description }}</span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.el-timeline { position: relative; }
.line { position: absolute; left: 4%; right: 4%; top: 3.4cqw; height: 0.4cqw; border-radius: 0.2cqw; background: var(--sl-cyan-line); }
.events { position: relative; list-style: none; margin: 0; padding: 0; display: grid; gap: 1.6cqw; }
.event { display: flex; flex-direction: column; align-items: center; gap: 0.8cqw; text-align: center; min-width: 0; }
.label { font-size: 1.5cqw; font-weight: 600; line-height: 1.6cqw; color: var(--sl-cyan-ink); }
.dot { width: 2.4cqw; height: 2.4cqw; box-sizing: border-box; border-radius: 50%; border: 0.5cqw solid var(--sl-surface); }
.description { font-size: 1.5cqw; line-height: 1.4; color: var(--sl-fg); overflow-wrap: anywhere; }
</style>
