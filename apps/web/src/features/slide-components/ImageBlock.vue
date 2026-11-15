<script setup lang="ts">
import { computed } from 'vue';
import { str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import MediaPlaceholder from './MediaPlaceholder.vue';

const props = defineProps<CatalogComponentProps>();
const fit = computed(() => (str(props.data.fit, 'contain') === 'cover' ? 'cover' : 'contain'));
const caption = computed(() => str(props.data.caption).trim());
const frame = computed(() => str(props.data.frame, 'rounded'));
/** A polaroid writes its caption on the paper, and a caption below needs its own row. */
const captionStyle = computed(() => (frame.value === 'polaroid' ? 'below' : str(props.data.captionStyle, 'pill')));
</script>

<template>
  <figure
    class="el-image"
    :data-frame="frame"
    :data-caption="caption ? captionStyle : 'none'"
    :data-shadow="data.shadow === true"
    :data-zoom="mode === 'student' && data.hoverZoom === true"
    data-testid="image"
  >
    <span class="photo">
      <img v-if="media" :src="media.url" :alt="str(data.alt)" :style="{ objectFit: fit }" draggable="false" />
      <MediaPlaceholder v-else :alt="str(data.alt, 'Imagen')" :prompt="str(data.prompt)" />
    </span>
    <figcaption v-if="caption" class="caption">{{ caption }}</figcaption>
  </figure>
</template>

<style scoped>
.el-image { position: relative; width: 100%; height: 100%; margin: 0; box-sizing: border-box; display: flex; flex-direction: column; }
.photo { position: relative; flex: 1; min-height: 0; display: block; border-radius: 1.2cqw; overflow: hidden; background: var(--sl-card-alt); }
img { width: 100%; height: 100%; display: block; transition: transform 0.5s ease; }
[data-zoom='true'] .photo:hover img { transform: scale(1.12); }
[data-frame='plain'] .photo { border-radius: 0; }
[data-frame='circle'] .photo { border-radius: 50%; }
[data-shadow='true'] .photo { box-shadow: var(--sl-elev-3); }
.caption { position: absolute; left: 1.2cqw; bottom: 1.2cqw; max-width: calc(100% - 2.4cqw); box-sizing: border-box; padding: 0.5cqw 1.1cqw; border-radius: 99cqw; background: var(--sl-scrim); color: var(--sl-white); font-size: 1.3cqw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
[data-frame='circle'][data-caption='pill'] .caption { left: 50%; transform: translateX(-50%); }
[data-caption='overlay'] .caption { left: 0; right: 0; bottom: 0; max-width: none; padding: 3cqw 1.6cqw 1.2cqw; border-radius: 0 0 1.2cqw 1.2cqw; background: linear-gradient(transparent, rgba(22, 22, 22, 0.82)); font-size: 1.6cqw; font-weight: 600; white-space: normal; }
[data-frame='plain'][data-caption='overlay'] .caption { border-radius: 0; }
[data-caption='below'] .caption { position: static; max-width: none; padding: 0.8cqw 0.4cqw 0; border-radius: 0; background: transparent; color: var(--sl-fg-2); font-size: 1.4cqw; text-align: center; white-space: normal; }
[data-frame='polaroid'] { padding: 1.2cqw 1.2cqw 1.4cqw; background: var(--sl-white); border-radius: 0.5cqw; box-shadow: var(--sl-elev-3); transform: rotate(-2deg); }
[data-frame='polaroid'] .photo { border-radius: 0.2cqw; box-shadow: none; }
[data-frame='polaroid'] .caption { color: var(--sl-ink-2); font-size: 1.5cqw; }
[data-frame='polaroid'][data-caption='none']::after { content: ''; height: 2.4cqw; flex: none; }
</style>
