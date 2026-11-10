<script setup lang="ts">
import { ref } from 'vue';
import { t } from '../../i18n/index.ts';
import type { FeedbackState } from './feedback-state.ts';

/**
 * Design aid of the canvas: a dashed gray field that stands where a message of the component will appear, so the
 * person sees the space it takes. Its height is the one of the longest message, so showing any of them does not move
 * what is around. One or two states get a button each; more of them are grouped in a menu.
 */
const props = defineProps<{ states: readonly FeedbackState[]; /** Not drawn, but it keeps its space so the layout stays the same. */ concealed?: boolean }>();

const active = ref<string | null>(null);
const menuOpen = ref(false);

function show(key: string): void {
  active.value = active.value === key ? null : key;
  menuOpen.value = false;
}
</script>

<template>
  <div class="fb" :data-concealed="props.concealed === true" data-testid="feedback-field">
    <div class="tools" role="group" :aria-label="t('editor.feedback.title')">
      <template v-if="props.states.length <= 2">
        <button
          v-for="state in props.states"
          :key="state.key"
          type="button"
          class="chip"
          :aria-pressed="active === state.key"
          :data-tone="state.tone"
          :data-testid="`feedback-show-${state.key}`"
          @pointerdown.stop
          @keydown.stop
          @click.stop="show(state.key)"
        >{{ state.label }}</button>
      </template>
      <template v-else>
        <button
          type="button"
          class="chip more"
          aria-haspopup="menu"
          :aria-expanded="menuOpen"
          :aria-label="t('editor.feedback.more')"
          :title="t('editor.feedback.more')"
          data-testid="feedback-more"
          @pointerdown.stop
          @keydown.stop
          @click.stop="menuOpen = !menuOpen"
        >&#8943;</button>
        <ul v-if="menuOpen" class="menu" role="menu">
          <li v-for="state in props.states" :key="state.key" role="none">
            <button
              type="button"
              role="menuitemradio"
              :aria-checked="active === state.key"
              :data-testid="`feedback-show-${state.key}`"
              @pointerdown.stop
              @keydown.stop
              @click.stop="show(state.key)"
            >{{ state.label }}</button>
          </li>
        </ul>
      </template>
    </div>
    <!-- Every message sits in the same grid cell and only the active one is visible, so the field keeps the height of the longest. -->
    <div class="body">
      <span class="cell hint" :data-shown="active === null">{{ t('editor.feedback.title') }}</span>
      <div v-for="state in props.states" :key="state.key" class="cell msg" :data-tone="state.tone" :data-shown="active === state.key">
        <strong v-if="state.heading" class="heading">{{ state.heading }}</strong>
        <span>{{ state.message }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* The field is part of the design, not of the slide: its text and chips use pixels, like the tags of the canvas, and a
   fixed gray that reads on any background. The content layer of the canvas ignores the pointer, so only the chips ask for it. */
.fb { position: relative; box-sizing: border-box; border: 1px dashed rgba(110, 120, 140, 0.9); border-radius: 1cqw; background: rgba(110, 120, 140, 0.12); }
.fb[data-concealed='true'] { visibility: hidden; }
.tools { position: absolute; top: -9px; right: 8px; z-index: 3; display: flex; gap: 4px; pointer-events: none; }
.chip { height: 16px; padding: 0 7px; border: 1px solid rgba(110, 120, 140, 0.9); border-radius: 8px; background: #fff; color: #4a5568; font: inherit; font-size: 10px; font-weight: 500; line-height: 14px; cursor: pointer; pointer-events: auto; }
.chip[aria-pressed='true'][data-tone='success'] { background: var(--sl-green-soft); border-color: var(--sl-green-ink); color: var(--sl-green-ink); }
.chip[aria-pressed='true'][data-tone='failure'] { background: var(--sl-red-soft); border-color: var(--sl-red-ink); color: var(--sl-red-ink); }
.chip[aria-pressed='true'][data-tone='neutral'] { background: #4a5568; border-color: #4a5568; color: #fff; }
.chip.more { padding: 0 6px; font-size: 12px; font-weight: 700; line-height: 10px; }
.menu { position: absolute; top: 20px; right: 0; margin: 0; padding: 2px; min-width: 96px; list-style: none; border: 1px solid rgba(110, 120, 140, 0.9); border-radius: 6px; background: #fff; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18); pointer-events: auto; }
.menu button { display: block; width: 100%; padding: 3px 8px; border: 0; border-radius: 4px; background: transparent; color: #2d3748; font: inherit; font-size: 11px; text-align: left; cursor: pointer; }
.menu button:hover, .menu button[aria-checked='true'] { background: rgba(110, 120, 140, 0.2); }
.body { display: grid; }
/* The padding and the type match the message the student sees, so the field takes the same height. */
.cell { grid-area: 1 / 1; padding: 1cqw 1.4cqw; border-radius: 1cqw; font-size: 1.5cqw; line-height: 1.4; }
.cell[data-shown='false'] { visibility: hidden; }
.hint { color: rgba(74, 85, 104, 0.9); font-style: italic; }
.msg { display: flex; flex-direction: column; gap: 0.3cqw; }
.msg[data-tone='success'] { background: var(--sl-green-soft); color: var(--sl-green-ink); }
.msg[data-tone='failure'] { background: var(--sl-red-soft); color: var(--sl-red-ink); }
.msg[data-tone='neutral'] { background: var(--sl-card); color: var(--sl-ink-2); }
.heading { font-weight: 600; color: var(--sl-ink); }
</style>
