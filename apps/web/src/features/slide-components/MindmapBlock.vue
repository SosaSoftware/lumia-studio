<script setup lang="ts">
import { computed } from 'vue';
import { leadingEmoji, legacyMind, parseMindmap } from '@lumia/packages/catalog';
import type { MindNode } from '@lumia/packages/catalog';
import { list, rec, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useMotion } from './motion.ts';
import { colorKey, fillVars, toneVars, vividColor } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const { live } = useMotion(props);
const animated = computed(() => live.value && props.data.animated !== false);

/** The map as text, or, for maps made before it was text, the center and branches they were saved with. */
const tree = computed<MindNode | null>(() => {
  const code = str(props.data.code);
  if (code.trim() !== '') return parseMindmap(code).root;
  const center = str(props.data.center);
  if (center === '') return null;
  return legacyMind(
    `${str(props.data.emoji) === '' ? '' : `${str(props.data.emoji)} `}${center}`,
    list(props.data.branches).map((item) => ({ text: str(rec(item).text), emoji: str(rec(item).emoji), details: list(rec(item).details).map((detail) => str(detail)) })),
  );
});

/** Texts of every node under `node`, level by level: a branch shows its sub-ideas, and theirs, as chips. */
function descendants(node: MindNode): string[] {
  return node.children.flatMap((child) => [child.text, ...descendants(child)]);
}

const center = computed(() => leadingEmoji(tree.value?.text ?? ''));
const centerEmoji = computed(() => center.value.emoji);
const centerText = computed(() => center.value.rest);

/** Branches spread on an ellipse around the center, starting at the top and going clockwise. */
const branches = computed(() => {
  const items = tree.value?.children ?? [];
  return items.map((item, index) => {
    const angle = (index / items.length) * Math.PI * 2 - Math.PI / 2;
    const x = 50 + 37 * Math.cos(angle);
    const y = 50 + 36 * Math.sin(angle);
    const color = props.data.colorful === false ? colorKey(props.data.color, 'primary') : vividColor(index + 1);
    const head = leadingEmoji(item.text);
    return {
      text: head.rest,
      emoji: head.emoji,
      details: descendants(item).map((detail) => leadingEmoji(detail).rest),
      x,
      y,
      color,
      // The bend makes every branch curve the same way around the center.
      curve: `M50 50 Q${String(50 + (x - 50) * 0.55 - (y - 50) * 0.18)} ${String(50 + (y - 50) * 0.55 + (x - 50) * 0.18)} ${String(x)} ${String(y)}`,
    };
  });
});
const dense = computed(() => branches.value.length > 5);
</script>

<template>
  <div class="el-mindmap" :data-animated="animated" :data-dense="dense" role="img" :aria-label="`Mapa mental: ${centerText}. ${branches.map((branch) => [branch.text, ...branch.details].join(', ')).join('; ')}`">
    <svg class="links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path v-for="(branch, index) in branches" :key="index" :d="branch.curve" fill="none" :style="{ ...toneVars(branch.color), animationDelay: `${index * 0.1}s` }" class="link" pathLength="1" vector-effect="non-scaling-stroke" />
    </svg>
    <span class="center" :style="fillVars(data.color, 'gradient', 'primary')" aria-hidden="true">
      <span v-if="centerEmoji" class="center-emoji">{{ centerEmoji }}</span>
      <span class="center-text">{{ centerText }}</span>
    </span>
    <span v-for="(branch, index) in branches" :key="index" class="branch" :style="{ ...toneVars(branch.color), left: `${branch.x}%`, top: `${branch.y}%`, animationDelay: `${0.2 + index * 0.1}s` }" aria-hidden="true">
      <span class="branch-head"><span v-if="branch.emoji" class="branch-emoji">{{ branch.emoji }}</span>{{ branch.text }}</span>
      <span v-if="branch.details.length" class="details">
        <span v-for="(detail, position) in branch.details" :key="position" class="detail">{{ detail }}</span>
      </span>
    </span>
  </div>
</template>

<style scoped>
.el-mindmap { position: relative; width: 100%; height: 100%; }
.links { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.link { stroke: var(--c); stroke-width: 3; stroke-linecap: round; opacity: 0.7; }
[data-animated='true'] .link { stroke-dasharray: 1; animation: mindmap-draw 0.6s ease-out both; }
.center { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: max-content; max-width: 26%; display: flex; flex-direction: column; align-items: center; gap: 0.3cqw; padding: 1.2cqw 2cqw; border-radius: 99cqw; background: var(--fill); color: var(--fill-fg); box-shadow: 0 0 0 0.7cqw var(--c-soft), var(--sl-elev-2); text-align: center; z-index: 1; }
[data-animated='true'] .center { animation: mindmap-pop 0.5s var(--sl-ease-bounce) both; }
.center-emoji { font-size: 2.6cqw; line-height: 1; }
.center-text { font-size: 2cqw; font-weight: 600; line-height: 1.15; overflow-wrap: anywhere; }
.branch { position: absolute; transform: translate(-50%, -50%); width: max-content; max-width: 24%; display: flex; flex-direction: column; align-items: center; gap: 0.5cqw; z-index: 1; }
[data-animated='true'] .branch { animation: mindmap-pop 0.45s var(--sl-ease-bounce) both; }
.branch-head { display: inline-flex; align-items: center; gap: 0.5cqw; padding: 0.6cqw 1.2cqw; border-radius: 1cqw; background: var(--sl-card); border: 0.2cqw solid var(--c); color: var(--c-ink); font-size: 1.55cqw; font-weight: 600; line-height: 1.2; text-align: center; box-shadow: var(--sl-elev-1); overflow-wrap: anywhere; }
.branch-emoji { font-size: 1.15em; }
.details { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.4cqw; }
.detail { padding: 0.25cqw 0.8cqw; border-radius: 99cqw; background: var(--c-soft); color: var(--c-ink); font-size: 1.15cqw; line-height: 1.3; white-space: nowrap; }
[data-dense='true'] .branch-head { font-size: 1.3cqw; padding: 0.5cqw 0.9cqw; }
[data-dense='true'] .detail { font-size: 1cqw; }

@keyframes mindmap-draw {
  from { stroke-dashoffset: 1; }
  to { stroke-dashoffset: 0; }
}

@keyframes mindmap-pop {
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
  to { opacity: 1; transform: translate(-50%, -50%); }
}
</style>
