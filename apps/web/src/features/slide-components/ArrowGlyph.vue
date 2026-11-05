<script setup lang="ts">
import { computed } from 'vue';

/** The design's arrow: a rounded line and a head drawn with borders, laid out per direction without rotating the box. */
const props = withDefaults(defineProps<{ direction?: string; color: string; weight?: number }>(), { direction: 'right', weight: 2 });

const thickness = computed(() => 0.15 * props.weight + 0.15);
const vertical = computed(() => props.direction === 'up' || props.direction === 'down');
const headFirst = computed(() => props.direction === 'left' || props.direction === 'up');
const head = computed(() => {
  const half = `${String(thickness.value * 2.6)}cqw`;
  const length = `${String(thickness.value * 4.2)}cqw`;
  const solid = `${length} solid ${props.color}`;
  const clear = `${half} solid transparent`;
  switch (props.direction) {
    case 'left':
      return { borderTop: clear, borderBottom: clear, borderRight: solid };
    case 'up':
      return { borderLeft: clear, borderRight: clear, borderBottom: solid };
    case 'down':
      return { borderLeft: clear, borderRight: clear, borderTop: solid };
    default:
      return { borderTop: clear, borderBottom: clear, borderLeft: solid };
  }
});
const line = computed(() => (vertical.value ? { width: `${String(thickness.value)}cqw`, background: props.color } : { height: `${String(thickness.value)}cqw`, background: props.color }));
</script>

<template>
  <div class="arrow" :data-vertical="vertical" :data-head-first="headFirst" aria-hidden="true">
    <span class="line" :style="line"></span>
    <span class="head" :style="head"></span>
  </div>
</template>

<style scoped>
.arrow { width: 100%; height: 100%; display: flex; align-items: center; }
.arrow[data-vertical='true'] { flex-direction: column; }
.arrow[data-head-first='true'] { flex-direction: row-reverse; }
.arrow[data-vertical='true'][data-head-first='true'] { flex-direction: column-reverse; }
.line { flex: 1; border-radius: 0.3cqw; }
.head { width: 0; height: 0; flex: none; }
</style>
