<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { list, rec, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';

const props = defineProps<CatalogComponentProps>();
const sections = computed(() => list(props.data.sections).map((item) => ({ title: str(rec(item).title), content: str(rec(item).content) })));
const open = ref(new Set<number>([0]));

watch(
  () => props.data,
  () => {
    open.value = new Set([0]);
  },
);

function toggle(index: number): void {
  const next = new Set(open.value);
  if (next.has(index)) next.delete(index);
  else next.add(index);
  open.value = next;
}
</script>

<template>
  <div class="el-accordion" data-testid="accordion">
    <div v-for="(section, index) in sections" :key="index" class="section" :data-open="open.has(index)">
      <button v-if="mode === 'student'" type="button" class="head" :aria-expanded="open.has(index)" @click.stop="toggle(index)">
        <span class="title">{{ section.title }}</span><span class="sign" aria-hidden="true">{{ open.has(index) ? '−' : '+' }}</span>
      </button>
      <div v-else class="head">
        <span class="title">{{ section.title }}</span><span class="sign" aria-hidden="true">{{ open.has(index) ? '−' : '+' }}</span>
      </div>
      <div v-if="open.has(index)" class="body">{{ section.content }}</div>
    </div>
  </div>
</template>

<style scoped>
.el-accordion { display: flex; flex-direction: column; gap: 0.9cqw; }
.section { overflow: hidden; background: var(--sl-card); border: 0.12cqw solid var(--sl-line); border-radius: 1.2cqw; }
.section[data-open='true'] .head { background: var(--sl-blue-tint); }
.head { width: 100%; box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; gap: 1cqw; padding: 1.2cqw 1.6cqw; border: 0; background: transparent; color: var(--sl-ink); font: inherit; font-size: 1.7cqw; font-weight: 600; text-align: left; }
button.head { cursor: pointer; }
button.head:focus-visible { outline: 0.25cqw solid var(--sl-blue); outline-offset: -0.25cqw; }
.title { min-width: 0; overflow-wrap: anywhere; }
.sign { font-size: 2.2cqw; line-height: 1; color: var(--sl-blue); }
.body { padding: 0 1.6cqw 1.4cqw; font-size: 1.5cqw; line-height: 1.45; color: var(--sl-ink-2); white-space: pre-line; }
</style>
