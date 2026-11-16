<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { list, rec, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { toneVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const sections = computed(() => list(props.data.sections).map((item) => ({ title: str(rec(item).title), content: str(rec(item).content), emoji: str(rec(item).emoji).trim() })));
const multiple = computed(() => props.data.multiple !== false);
const initial = (): Set<number> => new Set(props.data.firstOpen === false ? [] : [0]);
const open = ref(initial());

watch(
  () => props.data,
  () => {
    open.value = initial();
  },
);

function toggle(index: number): void {
  const next = multiple.value ? new Set(open.value) : new Set<number>(open.value.has(index) ? [index] : []);
  if (next.has(index)) next.delete(index);
  else next.add(index);
  open.value = next;
}
</script>

<template>
  <div class="el-accordion" :data-style="str(data.style, 'cards')" :style="toneVars(data.color, 'primary')" data-testid="accordion">
    <div v-for="(section, index) in sections" :key="index" class="section" :data-open="open.has(index)">
      <component :is="mode === 'student' ? 'button' : 'div'" :type="mode === 'student' ? 'button' : undefined" class="head" :aria-expanded="mode === 'student' ? open.has(index) : undefined" @click.stop="mode === 'student' && toggle(index)">
        <span class="badge" aria-hidden="true">{{ section.emoji || index + 1 }}</span>
        <span class="title">{{ section.title }}</span>
        <span class="chevron" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg></span>
      </component>
      <div class="body-wrap">
        <div class="body-clip">
          <div class="body">{{ section.content }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.el-accordion { display: flex; flex-direction: column; gap: 0.9cqw; }
.section { overflow: hidden; background: var(--sl-card); border: 0.12cqw solid var(--sl-line); border-radius: 1.4cqw; box-shadow: var(--sl-elev-1); transition: border-color 0.2s ease, box-shadow 0.2s ease; }
.section[data-open='true'] { border-color: color-mix(in srgb, var(--c) 45%, var(--sl-line)); box-shadow: var(--sl-elev-2); }
[data-style='list'] { gap: 0; overflow: hidden; border: 0.12cqw solid var(--sl-line); border-radius: 1.4cqw; background: var(--sl-card); }
[data-style='list'] .section { border: 0; border-radius: 0; box-shadow: none; }
[data-style='list'] .section + .section { border-top: 0.12cqw solid var(--sl-line); }
.head { width: 100%; box-sizing: border-box; display: flex; align-items: center; gap: 1.2cqw; padding: 1.1cqw 1.6cqw; border: 0; background: transparent; color: var(--sl-ink); font: inherit; font-size: 1.7cqw; font-weight: 600; text-align: left; }
button.head { cursor: pointer; }
button.head:hover { background: var(--c-soft); }
button.head:focus-visible { outline: 0.25cqw solid var(--c); outline-offset: -0.25cqw; }
.badge { width: 3cqw; height: 3cqw; flex: none; display: flex; align-items: center; justify-content: center; border-radius: 0.9cqw; background: var(--c-soft); color: var(--c-ink); font-size: 1.4cqw; transition: background 0.2s ease, color 0.2s ease; }
.section[data-open='true'] .badge { background: var(--c-grad); color: var(--c-on); }
.title { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.chevron { width: 2.2cqw; height: 2.2cqw; flex: none; color: var(--c-ink); transition: transform 0.3s var(--sl-ease-bounce); }
.chevron svg { width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.section[data-open='true'] .chevron { transform: rotate(180deg); }
/* The grid row animates the height of the body, from 0 to its content. */
.body-wrap { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.3s ease; }
.section[data-open='true'] .body-wrap { grid-template-rows: 1fr; }
.body-clip { min-height: 0; overflow: hidden; }
.body { padding: 0 1.6cqw 1.4cqw calc(1.6cqw + 3cqw + 1.2cqw); font-size: 1.5cqw; line-height: 1.45; color: var(--sl-ink-2); white-space: pre-line; overflow-wrap: anywhere; }
</style>
