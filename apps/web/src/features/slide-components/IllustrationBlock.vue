<script setup lang="ts">
import { computed } from 'vue';
import { str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import MediaPlaceholder from './MediaPlaceholder.vue';

const props = defineProps<CatalogComponentProps>();
const STYLES: Record<string, string> = { flat: 'Plana', line: 'Líneas', photo: 'Foto' };
const styleName = computed(() => STYLES[str(props.data.style, 'flat')] ?? '');
</script>

<template>
  <div class="el-illustration" data-testid="illustration">
    <img v-if="media" :src="media.url" :alt="str(data.alt)" draggable="false" />
    <MediaPlaceholder v-else tone="illustration" :alt="str(data.alt, 'Ilustración')" :prompt="str(data.prompt)">
      <span class="chip">{{ styleName }}</span>
    </MediaPlaceholder>
  </div>
</template>

<style scoped>
.el-illustration { width: 100%; height: 100%; border-radius: 1.2cqw; overflow: hidden; }
img { width: 100%; height: 100%; display: block; object-fit: contain; }
.chip { position: absolute; right: 1cqw; top: 1cqw; padding: 0.3cqw 0.9cqw; border-radius: 99cqw; background: var(--sl-card); color: var(--sl-amber-ink); font-size: 1.1cqw; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
</style>
