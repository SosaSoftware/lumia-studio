<script setup lang="ts">
import { computed } from 'vue';
import { num, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useMotion } from './motion.ts';
import { formatNumber } from './render-helpers.ts';
import { fillVars, variantOf } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const { live, ambient } = useMotion(props);
const max = computed(() => Math.max(1, num(props.data.max, 100)));
const value = computed(() => Math.min(max.value, Math.max(0, num(props.data.value, 0))));
const percent = computed(() => (value.value / max.value) * 100);
const label = computed(() => str(props.data.label).trim());
</script>

<template>
  <div
    class="el-progress-bar"
    :data-size="str(data.size, 'md')"
    :data-animated="live && data.animated !== false"
    :data-striped="data.striped === true"
    :data-variant="variantOf(data.variant)"
    :data-moving="ambient"
    :style="fillVars(data.color, data.variant, 'primary')"
    data-testid="progress-bar"
  >
    <span v-if="label || data.showValue !== false" class="head">
      <span class="label">{{ label }}</span>
      <span v-if="data.showValue !== false" class="value">{{ formatNumber(percent, 0) }} %</span>
    </span>
    <span class="track" role="progressbar" :aria-valuemin="0" :aria-valuemax="max" :aria-valuenow="value" :aria-label="label || 'Progreso'">
      <span class="fill" :style="{ width: `${percent}%` }"></span>
    </span>
  </div>
</template>

<style scoped>
.el-progress-bar { display: flex; flex-direction: column; gap: 0.7cqw; --track: 1.4cqw; }
.el-progress-bar[data-size='sm'] { --track: 0.8cqw; }
.el-progress-bar[data-size='lg'] { --track: 2.4cqw; }
.head { display: flex; align-items: baseline; justify-content: space-between; gap: 1cqw; }
.label { min-width: 0; font-size: 1.5cqw; font-weight: 500; color: var(--sl-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.value { flex: none; font-size: 1.5cqw; font-weight: 600; color: var(--c-ink); font-variant-numeric: tabular-nums; }
.track { position: relative; height: var(--track); border-radius: 99cqw; background: var(--c-soft); overflow: hidden; }
.fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: inherit; background: var(--fill); transition: width 0.6s ease; }
[data-variant='soft'] .fill { background: var(--c); }
[data-animated='true'] .fill { animation: bar-fill 1.4s cubic-bezier(0.22, 1, 0.36, 1) both; }
[data-striped='true'] .fill::after { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.28) 0 0.8cqw, transparent 0.8cqw 1.6cqw); background-size: 2.26cqw 100%; }
[data-striped='true'][data-moving='true'] .fill::after { animation: bar-stripes 0.8s linear infinite; }

@keyframes bar-fill {
  from { width: 0; }
}

@keyframes bar-stripes {
  to { background-position: 2.26cqw 0; }
}
</style>
