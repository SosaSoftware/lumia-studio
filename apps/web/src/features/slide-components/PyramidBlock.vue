<script setup lang="ts">
import { computed } from 'vue';
import { list, rec, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useMotion } from './motion.ts';
import { colorKey, toneVars, vividColor } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const { live } = useMotion(props);
const inverted = computed(() => props.data.inverted === true);
const describe = computed(() => props.data.showDescriptions !== false);

/**
 * Levels from the top of the drawing to its bottom. Each level is a band of the triangle: its top and bottom widths
 * are the share of the base the triangle has at that height.
 */
const levels = computed(() => {
  const items = list(props.data.levels).map((item) => ({ label: str(rec(item).label), description: str(rec(item).description) }));
  const count = items.length;
  const ordered = inverted.value ? [...items].reverse() : items;
  return ordered.map((item, row) => {
    const order = inverted.value ? count - 1 - row : row;
    const topShare = inverted.value ? (count - row) / count : row / count;
    const bottomShare = inverted.value ? (count - row - 1) / count : (row + 1) / count;
    const top = 50 * (1 - topShare);
    const bottom = 50 * (1 - bottomShare);
    const color = props.data.colorful === false ? colorKey(props.data.color, 'orange') : vividColor(order + 2);
    const tint = props.data.colorful === false ? 100 - order * Math.min(14, 50 / Math.max(1, count - 1)) : 100;
    return {
      ...item,
      clip: `polygon(${String(top)}% 0, ${String(100 - top)}% 0, ${String(100 - bottom)}% 100%, ${String(bottom)}% 100%)`,
      // The narrow tip leaves little room: its label sits low inside the band.
      tip: !inverted.value && row === 0 ? 'up' : inverted.value && row === count - 1 ? 'down' : 'none',
      style: { ...toneVars(color), '--tint': `${String(tint)}%`, '--band-fg': tint < 75 ? 'var(--c-ink)' : 'var(--c-on)', animationDelay: `${String(order * 0.12)}s` },
    };
  });
});
</script>

<template>
  <div class="el-pyramid" :data-animated="live && data.animated !== false" :data-describe="describe" data-testid="pyramid">
    <ol class="levels" :aria-label="`Pirámide de ${levels.length} niveles`">
      <li v-for="(level, index) in levels" :key="index" class="level" :style="level.style">
        <span class="band" :style="{ clipPath: level.clip }">
          <span class="label" :data-tip="level.tip">{{ level.label }}</span>
        </span>
        <span v-if="describe && level.description" class="description"><span class="leader" aria-hidden="true"></span>{{ level.description }}</span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.el-pyramid { width: 100%; height: 100%; }
.levels { list-style: none; margin: 0; padding: 0; height: 100%; display: flex; flex-direction: column; gap: 0.5cqw; }
.level { flex: 1 1 0; min-height: 0; display: grid; grid-template-columns: 1fr; align-items: stretch; gap: 1.6cqw; }
[data-describe='true'] .level { grid-template-columns: 58% 1fr; }
[data-animated='true'] .level { animation: sl-rise 0.45s ease-out both; }
.band { display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--c) var(--tint), var(--sl-white)); background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(0, 0, 0, 0.06)); color: var(--band-fg); }
.label { max-width: 46%; font-size: 1.6cqw; font-weight: 600; line-height: 1.15; text-align: center; overflow-wrap: anywhere; }
.label[data-tip='up'] { max-width: 30%; align-self: flex-end; margin-bottom: 0.6cqw; font-size: 1.35cqw; }
.label[data-tip='down'] { max-width: 30%; align-self: flex-start; margin-top: 0.6cqw; font-size: 1.35cqw; }
.description { position: relative; align-self: center; display: flex; align-items: center; gap: 1cqw; font-size: 1.35cqw; line-height: 1.3; color: var(--sl-fg-2); overflow-wrap: anywhere; }
.leader { flex: none; width: 2cqw; height: 0; border-top: 0.2cqw dashed var(--c); }
</style>
