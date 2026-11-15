<script setup lang="ts">
import { computed } from 'vue';
import { str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useMotion } from './motion.ts';
import { fillVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const { ambient } = useMotion(props);
const emoji = computed(() => str(props.data.emoji).trim());
</script>

<template>
  <div class="el-banner" :data-shape="str(data.shape, 'ribbon')" :data-shine="ambient && data.animated !== false" :style="fillVars(data.color, data.variant, 'pink')" data-testid="banner">
    <span class="body">
      <span v-if="emoji" class="emoji" aria-hidden="true">{{ emoji }}</span>
      <span class="text">{{ str(data.text) }}</span>
    </span>
  </div>
</template>

<style scoped>
.el-banner { width: 100%; height: 100%; container-type: size; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 0.4cqw 0.8cqw rgba(22, 22, 22, 0.16)); }
.body { position: relative; width: 100%; height: 100%; box-sizing: border-box; display: flex; align-items: center; justify-content: center; gap: 0.5em; padding: 0 1.4em; background: var(--fill); color: var(--fill-fg); font-size: min(40cqh, 5.4cqw); font-weight: 600; line-height: 1.1; overflow: hidden; border-radius: 0.5em; }
.text { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.emoji { flex: none; }
[data-shape='pill'] .body { border-radius: 99em; }
[data-shape='ribbon'] .body { border-radius: 0; padding: 0 1.7em; clip-path: polygon(0 0, 100% 0, calc(100% - 0.9em) 50%, 100% 100%, 0 100%, 0.9em 50%); }
[data-shape='tag'] .body { border-radius: 0 0.5em 0.5em 0; padding-left: 2em; clip-path: polygon(1em 0, 100% 0, 100% 100%, 1em 100%, 0 50%); }
[data-shine='true'] .body::after { content: ''; position: absolute; inset: 0; background: linear-gradient(110deg, transparent 35%, rgba(255, 255, 255, 0.45) 50%, transparent 65%); background-size: 250% 100%; animation: sl-shine 3.2s linear infinite; pointer-events: none; }
</style>
