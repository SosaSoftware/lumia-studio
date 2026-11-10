<script setup lang="ts">
import { computed } from 'vue';
import { SLIDE_HEIGHT } from '@lumia/packages/catalog';
import { t } from '../../i18n/index.ts';
import StudioIcon from '../../ui/StudioIcon.vue';
import type { Geometry } from './geometry.ts';
import type { AlignKind, DistributeAxis } from './selection-geometry.ts';

/**
 * Outline and tools of a selection of several elements: the dashed box that holds them all, and a bar to align,
 * distribute or delete them. It sits outside the clipped slide surface, like the handles of a single element.
 */
const props = defineProps<{
  /** Rectangle that holds every selected element, in `cqw`. */
  bounds: Geometry;
  count: number;
}>();
const emit = defineEmits<{
  align: [kind: AlignKind];
  distribute: [axis: DistributeAxis];
  remove: [];
}>();

const box = computed(() => ({ left: `${String(props.bounds.x)}cqw`, top: `${String(props.bounds.y)}cqw`, width: `${String(props.bounds.w)}cqw`, height: `${String(props.bounds.h)}cqw` }));
/** The bar goes above the selection, or below it when there is no room above. */
const below = computed(() => props.bounds.y < 9 && props.bounds.y + props.bounds.h < SLIDE_HEIGHT - 9);

const ALIGNMENTS: readonly { kind: AlignKind; icon: string; label: 'alignLeft' | 'alignCenter' | 'alignRight' | 'alignTop' | 'alignMiddle' | 'alignBottom' }[] = [
  { kind: 'left', icon: 'align-left', label: 'alignLeft' },
  { kind: 'center', icon: 'align-center', label: 'alignCenter' },
  { kind: 'right', icon: 'align-right', label: 'alignRight' },
  { kind: 'top', icon: 'align-top', label: 'alignTop' },
  { kind: 'middle', icon: 'align-middle', label: 'alignMiddle' },
  { kind: 'bottom', icon: 'align-bottom', label: 'alignBottom' },
];
</script>

<template>
  <div class="overlay" data-testid="group-overlay">
    <div class="box" :style="box" aria-hidden="true"></div>
    <div class="bar" :class="{ below }" :style="box" role="toolbar" :aria-label="t('editor.group.toolbar')" data-testid="group-toolbar" @pointerdown.stop>
      <div class="tools">
        <button v-for="item in ALIGNMENTS" :key="item.kind" type="button" :title="t(`editor.group.${item.label}`)" :aria-label="t(`editor.group.${item.label}`)" :data-testid="`group-align-${item.kind}`" @click="emit('align', item.kind)">
          <StudioIcon :name="item.icon" :size="15" :stroke="2" />
        </button>
        <span class="sep" aria-hidden="true"></span>
        <button type="button" :disabled="count < 3" :title="t('editor.group.distributeHorizontal')" :aria-label="t('editor.group.distributeHorizontal')" data-testid="group-distribute-horizontal" @click="emit('distribute', 'horizontal')">
          <StudioIcon name="distribute-h" :size="15" :stroke="2" />
        </button>
        <button type="button" :disabled="count < 3" :title="t('editor.group.distributeVertical')" :aria-label="t('editor.group.distributeVertical')" data-testid="group-distribute-vertical" @click="emit('distribute', 'vertical')">
          <StudioIcon name="distribute-v" :size="15" :stroke="2" />
        </button>
        <span class="sep" aria-hidden="true"></span>
        <button type="button" class="danger" :title="t('editor.group.remove')" :aria-label="t('editor.group.remove')" data-testid="group-remove" @click="emit('remove')">
          <StudioIcon name="trash" :size="15" :stroke="2" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: absolute; inset: 0; pointer-events: none; z-index: 3; }
.box { position: absolute; box-sizing: border-box; outline: 1.5px dashed var(--s-active); outline-offset: 2px; }
.bar { position: absolute; box-sizing: border-box; pointer-events: none; }
.tools { position: absolute; left: 50%; bottom: calc(100% + 10px); transform: translateX(-50%); display: flex; align-items: center; gap: 2px; padding: 3px; background: var(--s-panel); border: 1px solid var(--s-border); border-radius: 8px; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35); pointer-events: auto; white-space: nowrap; }
.bar.below .tools { bottom: auto; top: calc(100% + 10px); }
.tools button { width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; padding: 0; background: transparent; border: 0; border-radius: 5px; color: var(--s-text-2); cursor: pointer; }
.tools button:hover:not(:disabled) { background: var(--s-hover); color: var(--s-text); }
.tools button:disabled { opacity: 0.35; cursor: default; }
.tools button:focus-visible { outline: 2px solid var(--s-active); outline-offset: 1px; }
.tools button.danger:hover:not(:disabled) { color: var(--s-danger, #ef4444); }
.sep { width: 1px; height: 16px; margin: 0 3px; background: var(--s-border); }
</style>
