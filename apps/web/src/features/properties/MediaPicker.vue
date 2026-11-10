<script setup lang="ts">
import { ref } from 'vue';
import { ApiError } from '../../api/graphql-client.ts';
import type { MediaAsset, MediaRef } from '../../api/types.ts';
import { useApp } from '../../composables/app-context.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import { t } from '../../i18n/index.ts';
import MediaLibraryDialog from '../media/MediaLibraryDialog.vue';
import { UploadError, uploadMedia } from '../media/upload.ts';
import StudioIcon from '../../ui/StudioIcon.vue';

const props = defineProps<{ id: string; media: MediaRef | null; mediaId: string | null; canUpload: boolean; accept: string; disabled?: boolean }>();
const emit = defineEmits<{ pick: [asset: MediaAsset | null] }>();

const app = useApp();
const workspace = useWorkspace();
const busy = ref(false);
const error = ref<string | null>(null);
const libraryOpen = ref(false);

async function upload(event: Event): Promise<void> {
  const input = event.target instanceof HTMLInputElement ? event.target : null;
  const file = input?.files?.[0];
  if (file === undefined || props.disabled) return;
  busy.value = true;
  error.value = null;
  try {
    const categoryId = workspace.media.category;
    if (categoryId === null) throw new UploadError(t('properties.picker.openClassToUpload'));
    const asset = await uploadMedia(app.studio, categoryId, file);
    workspace.media.add(asset);
    emit('pick', asset);
  } catch (cause) {
    error.value = cause instanceof ApiError || cause instanceof Error ? cause.message : t('errors.uploadFailed');
  } finally {
    busy.value = false;
    if (input !== null) input.value = '';
  }
}

function choose(asset: MediaAsset): void {
  libraryOpen.value = false;
  emit('pick', asset);
}
</script>

<template>
  <div class="picker" :data-testid="`media-picker-${id}`">
    <div class="pv current">
      <img v-if="media && media.mimeType.startsWith('image/')" :src="media.url" alt="" class="mini" />
      <StudioIcon v-else :name="media ? 'cmp-video' : 'cmp-image'" :size="14" />
      <span v-if="media" class="name" data-testid="media-current">{{ media.name }}</span>
      <span v-else-if="mediaId" class="name">{{ t('properties.picker.assigned') }}</span>
      <span v-else class="none">{{ t('properties.picker.none') }}</span>
    </div>
    <div class="actions">
      <label v-if="canUpload" class="prv" :aria-disabled="busy || disabled">
        <StudioIcon name="upload" :size="13" :stroke="2" />{{ busy ? t('properties.picker.uploading') : t('properties.picker.upload') }}
        <input type="file" class="sr-only" :accept="accept" :disabled="busy || disabled" data-testid="media-upload" @change="upload" />
      </label>
      <button type="button" class="pub" :disabled="disabled" data-testid="media-library-open" @click="libraryOpen = true">
        <StudioIcon name="library" :size="13" :stroke="2" />{{ t('common.chooseFromLibrary') }}
      </button>
    </div>
    <button v-if="mediaId" type="button" class="remove" :disabled="disabled" data-testid="media-remove" @click="emit('pick', null)">{{ t('properties.picker.remove') }}</button>
    <span v-if="!canUpload" class="none" data-testid="media-upload-denied">{{ t('properties.picker.uploadDenied') }}</span>
    <span v-if="error" class="err" role="alert">{{ error }}</span>
    <MediaLibraryDialog v-if="libraryOpen" selectable :mime-filter="accept.split(',')[0]?.replace('*', '')" @close="libraryOpen = false" @select="choose" />
  </div>
</template>

<style scoped>
.picker { display: flex; flex-direction: column; gap: 6px; }
.current { min-width: 0; color: var(--s-text-2); }
.mini { width: 22px; height: 22px; border-radius: 4px; object-fit: cover; flex: none; }
.name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--s-text); }
.none { font-size: 12px; color: var(--s-text-2); line-height: 1.4; }
.actions { display: flex; flex-wrap: wrap; gap: 6px; }
label.prv { cursor: pointer; }
label.prv:focus-within { outline: 2px solid var(--s-active); outline-offset: 1px; }
.pub:disabled { opacity: 0.45; cursor: not-allowed; }
.remove { align-self: flex-start; padding: 0; background: transparent; border: 0; color: var(--s-danger); font: inherit; font-size: 12px; cursor: pointer; }
.err { font-size: 12px; color: var(--s-danger); }
</style>
