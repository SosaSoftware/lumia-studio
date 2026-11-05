<script setup lang="ts">
/** Lumi's six-pointed star with its six dots (docs/04-ui/design-system.md). */
withDefaults(defineProps<{ size?: number; color?: string; dots?: string; opacity?: number }>(), {
  size: 18,
  color: 'var(--s-lumi)',
  dots: 'var(--s-lumi-dots)',
  opacity: 1,
});
</script>

<template>
  <svg viewBox="-100 -105 200 210" :width="size" :height="size" aria-hidden="true" focusable="false" :style="{ opacity, flex: 'none' }">
    <path :style="{ fill: color }" d="M0,-100 C4,-6.9 4,-6.9 86.6,-50 C8,0 8,0 86.6,50 C4,6.9 4,6.9 0,100 C-4,6.9 -4,6.9 -86.6,50 C-8,0 -8,0 -86.6,-50 C-4,-6.9 -4,-6.9 0,-100Z" />
    <g :style="{ fill: dots }">
      <circle cx="35" cy="-60.6" r="13" /><circle cx="70" cy="0" r="13" /><circle cx="35" cy="60.6" r="13" />
      <circle cx="-35" cy="60.6" r="13" /><circle cx="-70" cy="0" r="13" /><circle cx="-35" cy="-60.6" r="13" />
    </g>
  </svg>
</template>
