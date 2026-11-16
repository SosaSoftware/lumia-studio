<script setup lang="ts">
import { computed } from 'vue';
import { list, rec, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useMotion } from './motion.ts';
import { colorKey, toneVars, vividColor } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const { live } = useMotion(props);
const showValues = computed(() => props.data.showValues !== false);

/** Each stage is narrower than the one above; the last one keeps 30 % of the width so its text fits. */
const stages = computed(() => {
  const items = list(props.data.stages);
  const count = Math.max(1, items.length);
  const step = 35 / count;
  return items.map((item, index) => {
    const top = index * step;
    const bottom = (index + 1) * step;
    const color = props.data.colorful === true ? vividColor(index) : colorKey(props.data.color, 'purple');
    const tint = props.data.colorful === true ? 100 : 100 - index * Math.min(14, 48 / count);
    return {
      label: str(rec(item).label),
      value: str(rec(item).value).trim(),
      clip: `polygon(${String(top)}% 0, ${String(100 - top)}% 0, ${String(100 - bottom)}% 100%, ${String(bottom)}% 100%)`,
      style: { ...toneVars(color), '--tint': `${String(tint)}%`, '--band-fg': tint < 75 ? 'var(--c-ink)' : 'var(--c-on)', animationDelay: `${String(index * 0.12)}s` },
    };
  });
});
</script>

<template>
  <ol class="el-funnel" :data-animated="live && data.animated !== false" :aria-label="`Embudo de ${stages.length} etapas`" data-testid="funnel">
    <li v-for="(stage, index) in stages" :key="index" class="stage" :style="{ ...stage.style, clipPath: stage.clip }">
      <span v-if="showValues && stage.value" class="value">{{ stage.value }}</span>
      <span class="label">{{ stage.label }}</span>
    </li>
  </ol>
</template>

<style scoped>
.el-funnel { list-style: none; margin: 0; padding: 0; width: 100%; height: 100%; display: flex; flex-direction: column; gap: 0.45cqw; filter: drop-shadow(0 0.4cqw 0.8cqw rgba(22, 22, 22, 0.12)); }
.stage { flex: 1 1 0; min-height: 0; display: flex; align-items: center; justify-content: center; gap: 1cqw; padding: 0 20%; background: color-mix(in srgb, var(--c) var(--tint), var(--sl-white)); background-image: linear-gradient(90deg, rgba(0, 0, 0, 0.06), rgba(255, 255, 255, 0.16) 50%, rgba(0, 0, 0, 0.06)); color: var(--band-fg); text-align: center; }
[data-animated='true'] .stage { animation: funnel-in 0.5s ease-out both; }
.value { flex: none; font-size: 2cqw; font-weight: 600; line-height: 1; }
.label { min-width: 0; font-size: 1.5cqw; font-weight: 500; line-height: 1.2; overflow-wrap: anywhere; }

@keyframes funnel-in {
  from { opacity: 0; transform: scaleX(0.6); }
  to { opacity: 1; transform: none; }
}
</style>
