<script setup lang="ts">
import { computed } from 'vue';
import { iconShapes } from './studio-icons.ts';

const props = withDefaults(defineProps<{ name: string; size?: number; stroke?: number }>(), { size: 16, stroke: 1.8 });
const shapes = computed(() => iconShapes(props.name));
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="stroke"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <template v-for="(shape, index) in shapes" :key="index">
      <path v-if="shape.kind === 'path'" :d="shape.d" :fill="shape.fill ? 'currentColor' : undefined" :stroke="shape.fill ? 'none' : undefined" />
      <rect
        v-else-if="shape.kind === 'rect'"
        :x="shape.x"
        :y="shape.y"
        :width="shape.w"
        :height="shape.h"
        :rx="shape.rx"
        :fill="shape.fill ? 'currentColor' : undefined"
        :stroke="shape.fill ? 'none' : undefined"
      />
      <circle v-else :cx="shape.cx" :cy="shape.cy" :r="shape.r" :fill="shape.fill ? 'currentColor' : undefined" :stroke="shape.fill ? 'none' : undefined" />
    </template>
  </svg>
</template>
