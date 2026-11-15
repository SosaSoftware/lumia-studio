<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { list, rec, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { toneVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const tabs = computed(() => list(props.data.tabs).map((item) => ({ title: str(rec(item).title), content: str(rec(item).content), emoji: str(rec(item).emoji).trim() })));
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
  <div class="el-tabs" :data-style="str(data.style, 'pills')" :style="toneVars(data.color, 'primary')" data-testid="tabs">
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
      ><span v-if="tab.emoji" class="tab-emoji" aria-hidden="true">{{ tab.emoji }}</span>{{ tab.title }}</button>
    </div>
    <div :key="active" class="panel" role="tabpanel">
      <template v-if="lines.length > 1">
        <span v-for="(line, index) in lines" :key="index" class="item"><span class="dot"></span>{{ line }}</span>
      </template>
      <p v-else class="paragraph">{{ lines[0] ?? '' }}</p>
    </div>
  </div>
</template>

<style scoped>
.el-tabs { height: 100%; display: flex; flex-direction: column; overflow: hidden; background: var(--sl-card); border: 0.12cqw solid var(--sl-line); border-radius: 1.6cqw; box-shadow: var(--sl-elev-1); }
.strip { flex: none; display: flex; gap: 0.6cqw; padding: 0.9cqw; background: var(--sl-card-alt); }
.tab-button { flex: 1; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 0.6cqw; padding: 1cqw 1.2cqw; line-height: 1.2; border: 0; border-radius: 99cqw; text-align: center; font: inherit; font-size: 1.6cqw; font-weight: 600; color: var(--sl-ink-3); background: transparent; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease; }
.tab-button:disabled { cursor: default; }
.tab-button:not(:disabled) { cursor: pointer; }
.tab-button:not(:disabled):hover { color: var(--c-ink); }
.tab-button[data-active='true'] { color: var(--c-on); background: var(--c-grad); box-shadow: 0 0.3cqw 0.9cqw color-mix(in srgb, var(--c) 35%, transparent); }
.tab-button:focus-visible { outline: 0.25cqw solid var(--c); outline-offset: 0.1cqw; }
.tab-emoji { flex: none; }
[data-style='underline'] .strip { gap: 0; padding: 0; background: transparent; border-bottom: 0.12cqw solid var(--sl-line); }
[data-style='underline'] .tab-button { border-radius: 0; padding: 1.3cqw 1.2cqw; }
[data-style='underline'] .tab-button[data-active='true'] { color: var(--c-ink); background: transparent; box-shadow: inset 0 -0.45cqw 0 var(--c); }
[data-style='cards'] .strip { gap: 0.4cqw; padding: 0.8cqw 0.8cqw 0; }
[data-style='cards'] .tab-button { border-radius: 1cqw 1cqw 0 0; background: var(--sl-line); }
[data-style='cards'] .tab-button[data-active='true'] { color: var(--c-ink); background: var(--sl-card); box-shadow: inset 0 0.4cqw 0 var(--c); }
.panel { padding: 1.8cqw 2cqw; display: flex; flex-direction: column; gap: 1.1cqw; min-height: 0; overflow: hidden; animation: sl-rise 0.3s ease-out both; }
.item { display: flex; align-items: center; gap: 1.2cqw; font-size: 1.7cqw; color: var(--sl-ink); }
.dot { width: 0.9cqw; height: 0.9cqw; flex: none; border-radius: 50%; background: var(--c); box-shadow: 0 0 0 0.25cqw var(--c-soft); }
.paragraph { margin: 0; font-size: 1.6cqw; line-height: 1.5; color: var(--sl-ink-2); white-space: pre-line; }
</style>
