<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { ApiError } from '../../api/graphql-client.ts';
import type { MediaAsset } from '../../api/types.ts';
import { ACTIONS, can, useApp } from '../../composables/app-context.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import { t } from '../../i18n/index.ts';
import ChipGroup from '../properties/ChipGroup.vue';
import StudioIcon from '../../ui/StudioIcon.vue';
import { UploadError, uploadMedia } from './upload.ts';

const props = defineProps<{
  /** The dialog returns the chosen medium; otherwise it only lets the person browse and upload. */
  selectable?: boolean;
  /** MIME prefix that the caller accepts, e.g. `image/` or `audio/`. */
  mimeFilter?: string;
}>();

const emit = defineEmits<{ close: []; select: [asset: MediaAsset] }>();

const app = useApp();
const workspace = useWorkspace();
const dialog = ref<HTMLElement | null>(null);
const loading = ref(true);
const uploading = ref(false);
const uploadError = ref<string | null>(null);
const filter = ref(props.mimeFilter ?? '');
const canUpload = computed(() => can(ACTIONS.upload));
let opener: Element | null = null;

const filters = computed(() => [
  { value: '', label: t('media.filters.all') },
  { value: 'image/', label: t('media.filters.image') },
  { value: 'audio/', label: t('media.filters.audio') },
  { value: 'video/', label: t('media.filters.video') },
  { value: 'application/', label: t('media.filters.documents') },
]);

const assets = computed(() => workspace.media.assets.value.filter((asset) => filter.value === '' || asset.mimeType.startsWith(filter.value)));

onMounted(async () => {
  opener = document.activeElement;
  document.addEventListener('keydown', onKeydown);
  await workspace.media.load(true);
  loading.value = false;
  await nextTick();
  dialog.value?.querySelector<HTMLElement>('button, input')?.focus();
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  if (opener instanceof HTMLElement) opener.focus();
});

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.stopPropagation();
    emit('close');
  }
}

async function upload(event: Event): Promise<void> {
  const input = event.target instanceof HTMLInputElement ? event.target : null;
  const file = input?.files?.[0];
  if (file === undefined) return;
  uploading.value = true;
  uploadError.value = null;
  try {
    const categoryId = workspace.media.category;
    if (categoryId === null) throw new UploadError(t('properties.picker.openClassToUpload'));
    const asset = await uploadMedia(app.studio, categoryId, file);
    workspace.media.add(asset);
    if (props.selectable && (props.mimeFilter === undefined || asset.mimeType.startsWith(props.mimeFilter))) emit('select', asset);
  } catch (error) {
    uploadError.value = error instanceof ApiError || error instanceof Error ? error.message : t('errors.uploadFailed');
  } finally {
    uploading.value = false;
    if (input !== null) input.value = '';
  }
}

function choose(asset: MediaAsset): void {
  if (props.selectable) emit('select', asset);
}

function kindIcon(mimeType: string): string {
  if (mimeType.startsWith('audio/')) return 'speaker';
  if (mimeType.startsWith('video/')) return 'cmp-video';
  if (mimeType.startsWith('image/')) return 'cmp-image';
  return 'cmp-paragraph';
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <section ref="dialog" class="dialog" role="dialog" aria-modal="true" aria-labelledby="media-title" data-testid="media-library">
      <div class="head">
        <div class="titles">
          <h2 id="media-title">{{ t('media.title') }}</h2>
          <p>{{ selectable ? t('media.selectHint') : t('media.browseHint') }}</p>
        </div>
        <button type="button" class="x" :aria-label="t('common.close')" :title="t('common.close')" data-testid="media-close" @click="emit('close')"><StudioIcon name="close" :size="18" /></button>
      </div>
      <div class="toolbar">
        <ChipGroup v-model="filter" :options="filters" :label="t('media.filterLabel')" testid="media-filter" />
        <label v-if="canUpload" class="pub upload" :aria-disabled="uploading">
          <StudioIcon name="upload" :size="13" :stroke="2" />{{ uploading ? t('media.uploading') : t('media.upload') }}
          <input type="file" class="sr-only" :accept="mimeFilter ? `${mimeFilter}*` : 'image/*,audio/*,video/*,application/pdf'" :disabled="uploading" data-testid="media-upload-input" @change="upload" />
        </label>
      </div>
      <p v-if="uploadError" class="error" role="alert" data-testid="media-upload-error">{{ uploadError }}</p>
      <div class="grid" data-testid="media-grid">
        <p v-if="loading" class="note">{{ t('media.loading') }}</p>
        <p v-else-if="assets.length === 0" class="note">{{ filter ? t('media.emptyOfType') : t('media.empty') }}</p>
        <button
          v-for="asset in assets"
          :key="asset.id"
          type="button"
          class="card"
          :class="{ selectable }"
          :aria-label="selectable ? t('media.choose', { name: asset.name }) : asset.name"
          :data-testid="`media-${asset.id}`"
          @click="choose(asset)"
        >
          <img v-if="asset.mimeType.startsWith('image/')" :src="asset.url" :alt="asset.name" class="thumb" loading="lazy" />
          <span v-else class="thumb icon"><StudioIcon :name="kindIcon(asset.mimeType)" :size="26" :stroke="1.6" /></span>
          <span class="name">{{ asset.name }}</span>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 120; background: var(--s-overlay); display: flex; align-items: center; justify-content: center; padding: 16px; }
.dialog { width: 100%; max-width: 720px; max-height: min(640px, 86vh); box-sizing: border-box; display: flex; flex-direction: column; gap: 16px; padding: 22px 24px 24px; background: var(--s-chrome); border: 1px solid var(--s-border); border-radius: 14px; box-shadow: 0 30px 80px var(--s-shadow); color: var(--s-text); font-size: 13px; }
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.titles h2 { margin: 0; font-size: 18px; font-weight: 500; }
.titles p { margin: 4px 0 0; font-size: 13px; color: var(--s-text-2); }
.x { width: 36px; height: 36px; flex: none; display: flex; align-items: center; justify-content: center; background: transparent; border: 0; border-radius: 8px; color: var(--s-text-2); cursor: pointer; }
.x:hover { background: var(--s-hover); }
.x:focus-visible { outline: 2px solid var(--s-active); outline-offset: 2px; }
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.upload { cursor: pointer; }
.upload:focus-within { outline: 2px solid var(--s-active); outline-offset: 1px; }
.error { margin: 0; padding: 8px 10px; border-radius: 8px; background: var(--s-danger-bg); color: var(--s-danger); font-size: 12px; }
.grid { flex: 1 1 auto; min-height: 120px; overflow: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 10px; align-content: start; }
.note { grid-column: 1 / -1; margin: 24px 0; text-align: center; color: var(--s-text-2); font-size: 12px; }
.card { padding: 0; display: flex; flex-direction: column; overflow: hidden; background: var(--s-raised); border: 1px solid var(--s-border); border-radius: 8px; color: var(--s-text); font: inherit; text-align: left; cursor: default; }
.card.selectable { cursor: pointer; }
.card.selectable:hover { border-color: var(--s-active); }
.card:focus-visible { outline: 2px solid var(--s-active); outline-offset: 1px; }
.thumb { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; display: block; background: var(--s-editor); }
.thumb.icon { display: flex; align-items: center; justify-content: center; color: var(--s-text-2); }
.name { padding: 6px 8px; font-size: 11px; color: var(--s-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
