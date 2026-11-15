<script setup lang="ts">
import { computed } from 'vue';
import { str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { toneVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const author = computed(() => str(props.data.author).trim());
const source = computed(() => str(props.data.source).trim());
</script>

<template>
  <figure class="el-quote" :data-variant="str(data.variant, 'editorial')" :data-align="str(data.align, 'center')" :style="toneVars(data.color, 'accent')" data-testid="quote">
    <span class="glyph" aria-hidden="true">“</span>
    <blockquote class="text">{{ str(data.text) }}</blockquote>
    <figcaption v-if="author || source" class="by">
      <span v-if="author" class="author">{{ author }}</span>
      <span v-if="source" class="source">{{ source }}</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.el-quote { position: relative; margin: 0; box-sizing: border-box; display: flex; flex-direction: column; align-items: flex-start; gap: 0.9cqw; text-align: left; }
.el-quote[data-align='center'] { align-items: center; text-align: center; }
.el-quote[data-align='right'] { align-items: flex-end; text-align: right; }
.glyph { height: 3.6cqw; font-family: Georgia, 'Times New Roman', serif; font-size: 9cqw; line-height: 1; color: var(--c); opacity: 0.55; }
.text { margin: 0; font-size: 2.3cqw; font-weight: 500; font-style: italic; line-height: 1.4; color: var(--sl-fg); overflow-wrap: anywhere; }
.by { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.3cqw 1cqw; font-size: 1.45cqw; }
[data-align='center'] .by { justify-content: center; }
[data-align='right'] .by { justify-content: flex-end; }
.author { font-weight: 600; color: var(--c-ink); }
.author::before { content: '— '; }
.source { color: var(--sl-fg-2); }
[data-variant='card'] { padding: 2.2cqw 2.6cqw; background: var(--sl-card); border-radius: 1.6cqw; box-shadow: var(--sl-elev-2); border-top: 0.6cqw solid var(--c); }
[data-variant='card'] .text { color: var(--sl-ink); }
[data-variant='card'] .source { color: var(--sl-ink-3); }
[data-variant='bar'] { padding: 0.4cqw 0 0.4cqw 2.4cqw; border-left: 0.6cqw solid var(--c); }
[data-variant='bar'] .glyph { display: none; }
</style>
