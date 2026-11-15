<script setup lang="ts">
import { computed } from 'vue';
import { list, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useMotion } from './motion.ts';
import { splitHighlights } from './render-helpers.ts';
import { toneVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const { live } = useMotion(props);
const align = computed(() => str(props.data.align, 'left'));
const segments = computed(() => splitHighlights(str(props.data.text), list(props.data.highlights).map((item) => str(item))));
</script>

<template>
  <p
    class="el-paragraph-highlight"
    :data-size="str(data.size, 'md')"
    :data-style="str(data.highlightStyle, 'marker')"
    :data-playing="live && data.animated !== false"
    :style="{ ...toneVars(data.color, 'warning'), textAlign: align === 'center' || align === 'right' ? align : 'left' }"
    data-testid="paragraph-highlight"
  >
    <template v-for="(segment, index) in segments" :key="index">
      <mark v-if="segment.marked" class="mark" :style="{ animationDelay: `${0.3 + segment.order * 0.35}s` }">{{ segment.text }}</mark>
      <template v-else>{{ segment.text }}</template>
    </template>
  </p>
</template>

<style scoped>
.el-paragraph-highlight { margin: 0; font-size: 1.8cqw; font-weight: 400; line-height: 1.6; color: var(--sl-fg-2); white-space: pre-line; overflow-wrap: anywhere; }
.el-paragraph-highlight[data-size='sm'] { font-size: 1.45cqw; }
.el-paragraph-highlight[data-size='lg'] { font-size: 2.2cqw; }
.mark { color: var(--sl-fg); font-weight: 600; background-color: transparent; background-repeat: no-repeat; background-size: 100% 100%; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
[data-style='marker'] .mark { padding: 0 0.25em; border-radius: 0.3em; background-image: linear-gradient(color-mix(in srgb, var(--c) 42%, transparent), color-mix(in srgb, var(--c) 42%, transparent)); background-position: 0 85%; background-size: 100% 62%; }
[data-style='underline'] .mark { background-image: linear-gradient(var(--c), var(--c)); background-position: 0 100%; background-size: 100% 0.16em; padding-bottom: 0.08em; }
[data-style='pill'] .mark { padding: 0.05em 0.5em; border-radius: 99cqw; background-image: linear-gradient(var(--c-soft), var(--c-soft)); color: var(--c-ink); }
[data-style='glow'] .mark { color: var(--c-ink); text-shadow: 0 0 0.6em color-mix(in srgb, var(--c) 70%, transparent); }
[data-playing='true'][data-style='marker'] .mark,
[data-playing='true'][data-style='underline'] .mark,
[data-playing='true'][data-style='pill'] .mark { animation: mark-draw 0.6s ease-out both; }
[data-playing='true'][data-style='glow'] .mark { animation: mark-glow 2.2s ease-in-out infinite; }

@keyframes mark-draw {
  from { background-size: 0% var(--mark-h, 100%); }
}

@keyframes mark-glow {
  0%, 100% { text-shadow: 0 0 0.3em color-mix(in srgb, var(--c) 40%, transparent); }
  50% { text-shadow: 0 0 0.9em var(--c); }
}

[data-style='marker'] .mark { --mark-h: 62%; }
[data-style='underline'] .mark { --mark-h: 0.16em; }
</style>
