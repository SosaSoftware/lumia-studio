<script setup lang="ts">
import { computed, ref } from 'vue';
import { str } from '../../api/decode.ts';
import { t } from '../../i18n/index.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import FeedbackField from './FeedbackField.vue';
import type { FeedbackState } from './feedback-state.ts';
import { useSlideContext } from './slide-context.ts';

const props = defineProps<CatalogComponentProps>();
const context = useSlideContext();
const open = ref(false);

const hotspots = computed(() => context.elements().filter((element) => element.component === 'hotspot'));
const number = computed(() => Math.max(1, hotspots.value.findIndex((element) => element.id === props.elementId) + 1));
const self = computed(() => context.elements().find((element) => element.id === props.elementId));
const SIDES = ['top', 'bottom', 'left', 'right'] as const;
type Side = (typeof SIDES)[number];
/** Where the message hangs: the one the person chose, or, for points made before the choice existed, beside the point on the side with more room. */
const side = computed<Side>(() => SIDES.find((candidate) => candidate === props.data.side) ?? ((self.value?.x ?? 0) > 55 ? 'left' : 'right'));
/** The point is always a circle: the diameter is the smaller side of the frame, in `cqw`. */
const diameter = computed(() => (self.value === undefined ? null : Math.min(self.value.w, self.value.h)));
const pointStyle = computed(() => (diameter.value === null ? undefined : { '--d': `${String(diameter.value)}cqw` }));
const showBubble = computed(() => props.mode === 'student' && open.value);
const states = computed<readonly FeedbackState[]>(() => [{ key: 'content', label: t('editor.feedback.content'), heading: str(props.data.label), message: str(props.data.content), tone: 'neutral' }]);

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') open.value = false;
}
</script>

<template>
  <div class="el-hotspot" data-testid="hotspot">
    <button v-if="mode === 'student'" type="button" class="point live" :style="pointStyle" :aria-expanded="open" :aria-label="str(data.label)" @click.stop="open = !open" @keydown="onKeydown">{{ number }}</button>
    <span v-else class="point" :style="pointStyle" aria-hidden="true">{{ number }}</span>
  </div>
  <!-- Outside the box of the point: the message hangs beside it and must not count as content that makes the frame taller. -->
  <div v-if="showBubble" class="bubble" :data-side="side" role="tooltip">
    <span class="title">{{ str(data.label) }}</span>
    <span class="text">{{ str(data.content) }}</span>
  </div>
  <div v-else-if="design" class="bubble slot" :data-side="side">
    <FeedbackField :states="states" :concealed="designHidden" />
  </div>
</template>

<style scoped>
.el-hotspot { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
/* The diameter comes from --d, so the point stays round whatever the size of its frame. */
.point { --d: 100%; flex: none; width: var(--d); height: var(--d); padding: 0; border: 0; border-radius: 50%; background: var(--sl-blue); color: var(--sl-white); display: flex; align-items: center; justify-content: center; font: inherit; font-size: max(1.5cqw, calc(var(--d) * 0.3)); font-weight: 700; box-shadow: 0 0 0 0.8cqw var(--sl-blue-halo); }
.point.live { cursor: pointer; }
.point.live:focus-visible { outline: 0.25cqw solid var(--sl-blue); outline-offset: 1cqw; }
@media (prefers-reduced-motion: no-preference) {
  .point.live { animation: halo 2s ease-in-out infinite; }
}
@keyframes halo { 0%, 100% { box-shadow: 0 0 0 0.8cqw var(--sl-blue-halo); } 50% { box-shadow: 0 0 0 1.3cqw var(--sl-blue-halo); } }
.bubble { position: absolute; top: 50%; transform: translateY(-50%); width: 19cqw; box-sizing: border-box; padding: 1.2cqw 1.6cqw; background: var(--sl-card); border-radius: 1cqw; box-shadow: 0 0.6cqw 2cqw var(--sl-shadow-2); display: flex; flex-direction: column; gap: 0.4cqw; z-index: 2; text-align: left; }
/* The design field has its own look and the padding of the message, so the slot adds none. */
.bubble.slot { padding: 0; background: none; box-shadow: none; }
.bubble[data-side='right'] { left: calc(100% + 1.6cqw); }
.bubble[data-side='left'] { right: calc(100% + 1.6cqw); }
.bubble[data-side='top'], .bubble[data-side='bottom'] { left: 50%; }
.bubble[data-side='top'] { top: auto; bottom: calc(100% + 1.6cqw); transform: translateX(-50%); }
.bubble[data-side='bottom'] { top: calc(100% + 1.6cqw); transform: translateX(-50%); }
.title { font-size: 1.7cqw; font-weight: 600; color: var(--sl-ink); }
.text { font-size: 1.5cqw; line-height: 1.4; color: var(--sl-ink-2); }
</style>
