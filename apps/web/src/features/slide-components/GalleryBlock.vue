<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { list, rec, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import MediaPlaceholder from './MediaPlaceholder.vue';
import { useSlideContext } from './slide-context.ts';
import { toneVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const context = useSlideContext();
const items = computed(() =>
  list(props.data.items).map((item) => {
    const mediaId = str(rec(item).mediaId);
    return { alt: str(rec(item).alt), caption: str(rec(item).caption), media: mediaId === '' ? null : context.media(mediaId) };
  }),
);
const index = ref(0);
const student = computed(() => props.mode === 'student');
const layout = computed(() => str(props.data.layout, 'slider'));
const captions = computed(() => props.data.showCaptions !== false);
const current = computed(() => items.value[index.value] ?? items.value[0] ?? null);
const columns = computed(() => (items.value.length <= 4 ? 2 : items.value.length <= 6 ? 3 : 4));

watch(items, () => {
  if (index.value >= items.value.length) index.value = 0;
});

function go(step: number): void {
  const count = items.value.length;
  if (count > 0) index.value = (index.value + step + count) % count;
}
</script>

<template>
  <div
    class="el-gallery"
    :data-layout="layout"
    :style="{ ...toneVars(data.color, 'primary'), '--columns': String(columns) }"
    data-testid="gallery"
    :aria-label="layout === 'slider' ? `Galería, imagen ${index + 1} de ${items.length}` : `Galería de ${items.length} imágenes`"
    role="group"
  >
    <template v-if="layout === 'slider'">
      <div class="viewer">
        <Transition name="gallery-fade" mode="out-in">
          <img v-if="current?.media" :key="index" :src="current.media.url" :alt="current.alt" draggable="false" />
          <MediaPlaceholder v-else :key="`empty-${index}`" :alt="current?.alt || 'Imagen'" compact />
        </Transition>
        <template v-if="items.length > 1">
          <button v-if="student" type="button" class="arrow prev" aria-label="Imagen anterior" @click.stop="go(-1)"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg></button>
          <span v-else class="arrow prev" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg></span>
          <button v-if="student" type="button" class="arrow next" aria-label="Imagen siguiente" @click.stop="go(1)"><svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" /></svg></button>
          <span v-else class="arrow next" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" /></svg></span>
        </template>
      </div>
      <div class="foot">
        <span class="caption">{{ captions ? (current?.caption ?? '') : '' }}</span>
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
    </template>
    <div v-else class="tiles">
      <figure v-for="(item, position) in items" :key="position" class="tile" :data-tall="layout === 'masonry' && position % 3 === 0">
        <img v-if="item.media" :src="item.media.url" :alt="item.alt" draggable="false" />
        <MediaPlaceholder v-else :alt="item.alt || 'Imagen'" compact />
        <figcaption v-if="captions && item.caption" class="tile-caption">{{ item.caption }}</figcaption>
      </figure>
    </div>
  </div>
</template>

<style scoped>
.el-gallery { height: 100%; display: flex; flex-direction: column; gap: 1cqw; }
.viewer { position: relative; flex: 1; min-height: 0; border-radius: 1.4cqw; overflow: hidden; box-shadow: var(--sl-elev-1); }
img { width: 100%; height: 100%; display: block; object-fit: cover; }
.arrow { position: absolute; top: 50%; transform: translateY(-50%); width: 3.6cqw; height: 3.6cqw; padding: 0; border: 0; border-radius: 50%; background: var(--sl-play-bg); color: var(--sl-ink); display: flex; align-items: center; justify-content: center; box-shadow: var(--sl-elev-1); transition: transform 0.2s var(--sl-ease-bounce); }
button.arrow { cursor: pointer; }
button.arrow:hover { transform: translateY(-50%) scale(1.12); }
button.arrow:focus-visible { outline: 0.25cqw solid var(--c); outline-offset: 0.2cqw; }
.prev { left: 1.2cqw; }
.next { right: 1.2cqw; }
.arrow svg { width: 50%; height: 50%; fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
.foot { display: flex; align-items: center; justify-content: space-between; gap: 1cqw; }
.caption { min-width: 0; font-size: 1.5cqw; color: var(--sl-fg-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dots { display: flex; gap: 0.6cqw; flex: none; }
.dot { width: 1cqw; height: 1cqw; padding: 0; border: 0; border-radius: 99cqw; background: var(--sl-line-2); transition: width 0.25s ease, background 0.25s ease; }
.dot[data-active='true'] { width: 2.6cqw; background: var(--c); }
button.dot { cursor: pointer; }
.gallery-fade-enter-active, .gallery-fade-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.gallery-fade-enter-from { opacity: 0; transform: scale(1.04); }
.gallery-fade-leave-to { opacity: 0; }
.tiles { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(var(--columns), 1fr); grid-auto-rows: 1fr; grid-auto-flow: dense; gap: 1cqw; }
.tile { position: relative; margin: 0; min-height: 0; border-radius: 1.2cqw; overflow: hidden; background: var(--sl-card-alt); box-shadow: var(--sl-elev-1); transition: transform 0.3s var(--sl-ease-bounce); }
.tile[data-tall='true'] { grid-row: span 2; }
.tile:hover { transform: scale(1.02); }
.tile-caption { position: absolute; left: 0; right: 0; bottom: 0; padding: 1.6cqw 1cqw 0.7cqw; background: linear-gradient(transparent, rgba(22, 22, 22, 0.78)); color: var(--sl-white); font-size: 1.15cqw; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
