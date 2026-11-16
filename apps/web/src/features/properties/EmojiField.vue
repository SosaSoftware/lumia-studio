<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useDismiss } from '../../composables/dismiss.ts';
import { t } from '../../i18n/index.ts';
import { emojiCategories, searchEmojis } from './emoji-data.ts';
import type { EmojiSetName } from './schema-form-model.ts';

/**
 * Emoji field of the Properties panel: a button that shows the current emoji and opens a picker with search and
 * categories. The `characters` set offers only people, professions, animals and fantasy figures. A text box below
 * the grid accepts any emoji typed or pasted with the system keyboard.
 */
const props = defineProps<{ modelValue: string; label: string; set: EmojiSetName; disabled?: boolean; testid?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const root = ref<HTMLElement | null>(null);
const search = ref<HTMLInputElement | null>(null);
const popover = ref<HTMLElement | null>(null);
const open = ref(false);
const query = ref('');
const active = ref(0);

const categories = computed(() => emojiCategories(props.set));
const results = computed(() => searchEmojis(categories.value, query.value));
const searching = computed(() => query.value.trim() !== '');
const shown = computed(() => (searching.value ? results.value : (categories.value[active.value]?.entries ?? [])));

useDismiss(root, () => open.value, () => {
  open.value = false;
});

async function toggle(): Promise<void> {
  if (props.disabled) return;
  open.value = !open.value;
  if (open.value) {
    query.value = '';
    await nextTick();
    search.value?.focus({ preventScroll: true });
    // The field often sits at the bottom of the panel: scroll so the whole picker is visible.
    popover.value?.scrollIntoView({ block: 'nearest' });
  }
}

function pick(emoji: string): void {
  emit('update:modelValue', emoji);
  open.value = false;
}

function typed(event: Event): void {
  const target = event.target;
  if (target instanceof HTMLInputElement) emit('update:modelValue', target.value.trim());
}
</script>

<template>
  <div ref="root" class="emoji-field">
    <div class="row">
      <button type="button" class="current" :disabled="disabled" :aria-expanded="open" :aria-label="`${label}: ${modelValue || t('properties.emoji.none')}`" :data-testid="testid" @click="toggle">
        <span v-if="modelValue" class="glyph" aria-hidden="true">{{ modelValue }}</span>
        <span v-else class="placeholder">{{ t('properties.emoji.none') }}</span>
        <span class="caret" aria-hidden="true">▾</span>
      </button>
      <button v-if="modelValue" type="button" class="clear" :disabled="disabled" :aria-label="t('properties.emoji.clear')" :title="t('properties.emoji.clear')" @click="pick('')">×</button>
    </div>
    <div v-if="open" ref="popover" class="popover" role="dialog" :aria-label="label">
      <input ref="search" v-model="query" class="pv search" type="search" :placeholder="t('properties.emoji.search')" :aria-label="t('properties.emoji.search')" />
      <div v-if="!searching" class="tabs" role="tablist">
        <button v-for="(category, index) in categories" :key="category.key" type="button" class="tab" role="tab" :aria-selected="index === active" :title="category.label" :aria-label="category.label" @click="active = index">{{ category.icon }}</button>
      </div>
      <div class="grid" role="listbox" :aria-label="label">
        <button v-for="entry in shown" :key="entry[0]" type="button" class="cell" role="option" :aria-selected="entry[0] === modelValue" :title="entry[1]" :aria-label="entry[1].split(' ')[0]" @click="pick(entry[0])">{{ entry[0] }}</button>
        <span v-if="searching && results.length === 0" class="empty">{{ t('properties.emoji.empty') }}</span>
      </div>
      <label class="custom">
        <span>{{ t('properties.emoji.custom') }}</span>
        <input class="pv" type="text" maxlength="14" :value="modelValue" :aria-label="t('properties.emoji.custom')" @change="typed" />
      </label>
    </div>
  </div>
</template>

<style scoped>
.emoji-field { position: relative; }
.row { display: flex; gap: 4px; }
.current { flex: 1; min-height: 30px; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 10px; background: var(--s-input); border: 1px solid var(--s-border); border-radius: 6px; color: var(--s-text); font: inherit; font-size: 12px; cursor: pointer; }
.current:hover:not(:disabled), .current[aria-expanded='true'] { border-color: var(--s-active); }
.current:focus-visible, .clear:focus-visible, .tab:focus-visible, .cell:focus-visible { outline: 2px solid var(--s-active); outline-offset: 1px; }
.current:disabled { opacity: 0.5; cursor: not-allowed; }
.glyph { font-size: 18px; line-height: 1; }
.placeholder { color: var(--s-text-2); }
.caret { color: var(--s-text-2); font-size: 10px; }
.clear { width: 30px; flex: none; background: var(--s-input); border: 1px solid var(--s-border); border-radius: 6px; color: var(--s-text-2); font-size: 16px; cursor: pointer; }
.clear:hover:not(:disabled) { color: var(--s-danger); border-color: var(--s-danger); }
.popover { position: absolute; z-index: 20; left: 0; right: 0; top: calc(100% + 4px); display: flex; flex-direction: column; gap: 6px; padding: 8px; background: var(--s-panel); border: 1px solid var(--s-border); border-radius: 8px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35); }
.search { width: 100%; color: var(--s-text); font: inherit; font-size: 12px; }
.tabs { display: flex; gap: 2px; }
.tab { flex: 1; padding: 4px 0; background: transparent; border: 0; border-bottom: 2px solid transparent; font-size: 16px; line-height: 1.2; cursor: pointer; opacity: 0.6; }
.tab[aria-selected='true'] { opacity: 1; border-bottom-color: var(--s-active); }
.grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; max-height: 168px; overflow-y: auto; }
.cell { aspect-ratio: 1; padding: 0; background: transparent; border: 0; border-radius: 6px; font-size: 18px; line-height: 1; cursor: pointer; }
.cell:hover { background: var(--s-active-soft); }
.cell[aria-selected='true'] { background: var(--s-active-soft); box-shadow: inset 0 0 0 1px var(--s-active); }
.empty { grid-column: 1 / -1; padding: 12px 0; text-align: center; font-size: 12px; color: var(--s-text-2); }
.custom { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--s-text-2); }
.custom input { flex: 1; min-width: 0; color: var(--s-text); font: inherit; font-size: 12px; }
</style>
