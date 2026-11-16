<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { list, num, rec, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import MediaPlaceholder from './MediaPlaceholder.vue';
import { useSlideContext } from './slide-context.ts';
import { toneVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const context = useSlideContext();
const root = ref<HTMLElement | null>(null);
const position = ref(50);
const dragging = ref(false);
const student = computed(() => props.mode === 'student');
const vertical = computed(() => str(props.data.orientation, 'horizontal') === 'vertical');

const images = computed(() =>
  list(props.data.images)
    .slice(0, 2)
    .map((item) => {
      const id = str(rec(item).mediaId);
      return { label: str(rec(item).label), alt: str(rec(item).alt), media: id === '' ? null : context.media(id) };
    }),
);
const before = computed(() => images.value[0] ?? null);
const after = computed(() => images.value[1] ?? null);

watch(
  () => props.data.start,
  (start) => {
    position.value = Math.min(100, Math.max(0, num(start, 50)));
  },
  { immediate: true },
);

/** The first image shows up to the divider; the second fills the rest. */
const clip = computed(() => (vertical.value ? `inset(0 0 ${String(100 - position.value)}% 0)` : `inset(0 ${String(100 - position.value)}% 0 0)`));
const dividerStyle = computed(() => (vertical.value ? { top: `${String(position.value)}%` } : { left: `${String(position.value)}%` }));

function moveTo(event: PointerEvent): void {
  const box = root.value?.getBoundingClientRect();
  if (box === undefined || box.width === 0 || box.height === 0) return;
  const ratio = vertical.value ? (event.clientY - box.top) / box.height : (event.clientX - box.left) / box.width;
  position.value = Math.min(100, Math.max(0, ratio * 100));
}

function onDown(event: PointerEvent): void {
  if (!student.value) return;
  dragging.value = true;
  if (event.currentTarget instanceof HTMLElement) event.currentTarget.setPointerCapture(event.pointerId);
  moveTo(event);
}

function onMove(event: PointerEvent): void {
  if (dragging.value) moveTo(event);
}

function onKeydown(event: KeyboardEvent): void {
  const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 5 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -5 : 0;
  if (step === 0) return;
  event.preventDefault();
  position.value = Math.min(100, Math.max(0, position.value + step));
}
</script>

<template>
  <div
    ref="root"
    class="el-before-after"
    :data-vertical="vertical"
    :data-live="student"
    :style="toneVars(data.color, 'primary')"
    data-testid="before-after"
    @pointerdown.stop="onDown"
    @pointermove="onMove"
    @pointerup="dragging = false"
    @pointercancel="dragging = false"
  >
    <div class="layer">
      <img v-if="after?.media" :src="after.media.url" :alt="after.alt" draggable="false" />
      <MediaPlaceholder v-else :alt="after?.label || 'Después'" compact />
    </div>
    <div class="layer top" :style="{ clipPath: clip }">
      <img v-if="before?.media" :src="before.media.url" :alt="before.alt" draggable="false" />
      <MediaPlaceholder v-else :alt="before?.label || 'Antes'" tone="illustration" compact />
    </div>
    <template v-if="data.showLabels !== false">
      <span class="tag first">{{ before?.label }}</span>
      <span class="tag second">{{ after?.label }}</span>
    </template>
    <div class="divider" :style="dividerStyle">
      <component
        :is="student ? 'button' : 'span'"
        :type="student ? 'button' : undefined"
        class="handle"
        :role="student ? 'slider' : undefined"
        :aria-label="student ? 'Comparar las imágenes' : undefined"
        :aria-valuemin="student ? 0 : undefined"
        :aria-valuemax="student ? 100 : undefined"
        :aria-valuenow="student ? Math.round(position) : undefined"
        @keydown="onKeydown"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6" /></svg>
      </component>
    </div>
  </div>
</template>

<style scoped>
.el-before-after { position: relative; width: 100%; height: 100%; border-radius: 1.4cqw; overflow: hidden; background: var(--sl-card-alt); box-shadow: var(--sl-elev-2); user-select: none; touch-action: none; }
.el-before-after[data-live='true'] { cursor: ew-resize; }
.el-before-after[data-live='true'][data-vertical='true'] { cursor: ns-resize; }
.layer { position: absolute; inset: 0; }
.layer img { width: 100%; height: 100%; display: block; object-fit: cover; pointer-events: none; }
.tag { position: absolute; top: 1.2cqw; padding: 0.4cqw 1.1cqw; border-radius: 99cqw; background: var(--sl-scrim); color: var(--sl-white); font-size: 1.2cqw; font-weight: 600; pointer-events: none; }
.tag.first { left: 1.2cqw; }
.tag.second { right: 1.2cqw; }
[data-vertical='true'] .tag.second { top: auto; bottom: 1.2cqw; right: auto; left: 1.2cqw; }
.divider { position: absolute; top: 0; bottom: 0; width: 0.4cqw; margin-left: -0.2cqw; background: var(--sl-white); box-shadow: 0 0 0.8cqw rgba(22, 22, 22, 0.35); pointer-events: none; }
[data-vertical='true'] .divider { top: auto; bottom: auto; left: 0; right: 0; width: auto; height: 0.4cqw; margin: -0.2cqw 0 0; }
.handle { position: absolute; top: 50%; left: 50%; width: 4.2cqw; height: 4.2cqw; padding: 0; transform: translate(-50%, -50%); display: flex; align-items: center; justify-content: center; border: 0.35cqw solid var(--sl-white); border-radius: 50%; background: var(--c-grad); color: var(--c-on); box-shadow: var(--sl-elev-2); pointer-events: auto; cursor: inherit; }
[data-vertical='true'] .handle svg { transform: rotate(90deg); }
.handle svg { width: 58%; height: 58%; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.handle:focus-visible { outline: 0.3cqw solid var(--c); outline-offset: 0.3cqw; }
</style>
