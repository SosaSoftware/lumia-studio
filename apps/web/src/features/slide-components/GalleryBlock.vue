<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { list, rec, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import MediaPlaceholder from './MediaPlaceholder.vue';
import { useSlideContext } from './slide-context.ts';

const props = defineProps<CatalogComponentProps>();
const context = useSlideContext();
const items = computed(() => list(props.data.items).map((item) => ({ mediaId: str(rec(item).mediaId), alt: str(rec(item).alt), caption: str(rec(item).caption) })));
const index = ref(0);
const student = computed(() => props.mode === 'student');
const current = computed(() => items.value[index.value] ?? items.value[0] ?? null);
const shown = computed(() => (current.value === null || current.value.mediaId === '' ? null : context.media(current.value.mediaId)));

watch(items, () => {
  if (index.value >= items.value.length) index.value = 0;
});

function go(step: number): void {
  const count = items.value.length;
  if (count > 0) index.value = (index.value + step + count) % count;
}
</script>

<template>
  <div class="el-gallery" data-testid="gallery" :aria-label="`Galería, imagen ${index + 1} de ${items.length}`" role="group">
    <div class="viewer">
      <img v-if="shown" :src="shown.url" :alt="current?.alt ?? ''" draggable="false" />
      <MediaPlaceholder v-else :alt="current?.alt || 'Imagen'" compact />
      <template v-if="items.length > 1">
        <button v-if="student" type="button" class="arrow prev" aria-label="Imagen anterior" @click.stop="go(-1)"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg></button>
        <span v-else class="arrow prev" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg></span>
        <button v-if="student" type="button" class="arrow next" aria-label="Imagen siguiente" @click.stop="go(1)"><svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" /></svg></button>
        <span v-else class="arrow next" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" /></svg></span>
      </template>
    </div>
    <div class="foot">
      <span class="caption">{{ current?.caption ?? '' }}</span>
      <span class="dots">
        <component
          :is="student ? 'button' : 'span'"
          v-for="(_, dot) in items"
          :key="dot"
          :type="student ? 'button' : undefined"
          class="dot"
          :data-active="dot === index"
          :aria-label="student ? `Ver la imagen ${dot + 1}` : undefined"
          @click.stop="student && (index = dot)"
        ></component>
      </span>
    </div>
  </div>
</template>

<style scoped>
.el-gallery { height: 100%; display: flex; flex-direction: column; gap: 1cqw; }
.viewer { position: relative; flex: 1; min-height: 0; border-radius: 1.2cqw; overflow: hidden; }
img { width: 100%; height: 100%; display: block; object-fit: cover; }
.arrow { position: absolute; top: 50%; transform: translateY(-50%); width: 3.6cqw; height: 3.6cqw; padding: 0; border: 0; border-radius: 50%; background: var(--sl-play-bg); color: var(--sl-ink); display: flex; align-items: center; justify-content: center; }
button.arrow { cursor: pointer; }
button.arrow:focus-visible { outline: 0.25cqw solid var(--sl-blue); outline-offset: 0.2cqw; }
.prev { left: 1.2cqw; }
.next { right: 1.2cqw; }
.arrow svg { width: 50%; height: 50%; fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
.foot { display: flex; align-items: center; justify-content: space-between; gap: 1cqw; }
.caption { min-width: 0; font-size: 1.5cqw; color: var(--sl-fg-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dots { display: flex; gap: 0.6cqw; flex: none; }
.dot { width: 1cqw; height: 1cqw; padding: 0; border: 0; border-radius: 50%; background: var(--sl-line-2); }
.dot[data-active='true'] { background: var(--sl-blue); }
button.dot { cursor: pointer; }
</style>
