<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { list, rec, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';

const props = defineProps<CatalogComponentProps>();
const tabs = computed(() => list(props.data.tabs).map((item) => ({ title: str(rec(item).title), content: str(rec(item).content) })));
const active = ref(0);
const lines = computed(() => (tabs.value[active.value]?.content ?? '').split('\n').map((line) => line.trim()).filter((line) => line !== ''));
const student = computed(() => props.mode === 'student');

watch(tabs, () => {
  if (active.value >= tabs.value.length) active.value = 0;
});

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
  event.preventDefault();
  const step = event.key === 'ArrowRight' ? 1 : -1;
  active.value = (active.value + step + tabs.value.length) % tabs.value.length;
  const target = event.currentTarget;
  if (target instanceof HTMLElement) target.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]').item(active.value).focus();
}
</script>

<template>
  <div class="el-tabs" data-testid="tabs">
    <div class="strip" role="tablist">
      <button
        v-for="(tab, index) in tabs"
        :key="index"
        type="button"
        class="tab-button"
        role="tab"
        :aria-selected="index === active"
        :data-active="index === active"
        :tabindex="student && index === active ? 0 : -1"
        :disabled="!student"
        @click.stop="active = index"
        @keydown="onKeydown"
      >{{ tab.title }}</button>
    </div>
    <div class="panel" role="tabpanel">
      <template v-if="lines.length > 1">
        <span v-for="(line, index) in lines" :key="index" class="item"><span class="dot"></span>{{ line }}</span>
      </template>
      <p v-else class="paragraph">{{ lines[0] ?? '' }}</p>
    </div>
  </div>
</template>

<style scoped>
.el-tabs { height: 100%; display: flex; flex-direction: column; overflow: hidden; background: var(--sl-card); border: 0.12cqw solid var(--sl-line); border-radius: 1.2cqw; }
.strip { flex: none; display: flex; border-bottom: 0.12cqw solid var(--sl-line); }
.tab-button { flex: 1; min-width: 0; padding: 1.2cqw; line-height: 1.2; border: 0; text-align: center; font: inherit; font-size: 1.7cqw; font-weight: 600; color: var(--sl-ink-3); background: var(--sl-card-alt); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tab-button:disabled { cursor: default; }
.tab-button:not(:disabled) { cursor: pointer; }
.tab-button[data-active='true'] { color: var(--sl-blue); background: var(--sl-card); box-shadow: inset 0 -0.4cqw 0 var(--sl-blue); }
.tab-button:focus-visible { outline: 0.25cqw solid var(--sl-blue); outline-offset: -0.25cqw; }
.panel { padding: 1.8cqw 2cqw; display: flex; flex-direction: column; gap: 1.2cqw; min-height: 0; overflow: hidden; }
.item { display: flex; align-items: center; gap: 1.2cqw; font-size: 1.7cqw; color: var(--sl-ink); }
.dot { width: 0.9cqw; height: 0.9cqw; flex: none; border-radius: 50%; background: var(--sl-blue); }
.paragraph { margin: 0; font-size: 1.6cqw; line-height: 1.5; color: var(--sl-ink-2); }
</style>
