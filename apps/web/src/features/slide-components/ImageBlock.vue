<script setup lang="ts">
import { computed } from 'vue';
import { str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import MediaPlaceholder from './MediaPlaceholder.vue';

const props = defineProps<CatalogComponentProps>();
const fit = computed(() => (str(props.data.fit, 'contain') === 'cover' ? 'cover' : 'contain'));
const caption = computed(() => str(props.data.caption).trim());
</script>

<template>
  <figure class="el-image" data-testid="image">
    <img v-if="media" :src="media.url" :alt="str(data.alt)" :style="{ objectFit: fit }" draggable="false" />
    <MediaPlaceholder v-else :alt="str(data.alt, 'Imagen')" :prompt="str(data.prompt)" />
    <figcaption v-if="caption" class="caption">{{ caption }}</figcaption>
  </figure>
</template>

<style scoped>
.el-image { position: relative; width: 100%; height: 100%; margin: 0; border-radius: 1.2cqw; overflow: hidden; background: var(--sl-card-alt); }
img { width: 100%; height: 100%; display: block; }
.caption { position: absolute; left: 1.2cqw; bottom: 1.2cqw; max-width: calc(100% - 2.4cqw); box-sizing: border-box; padding: 0.5cqw 1.1cqw; border-radius: 99cqw; background: var(--sl-scrim); color: var(--sl-white); font-size: 1.3cqw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
