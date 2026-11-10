<script setup lang="ts">
import { computed, ref } from 'vue';
import type { AudioClip, AudioKind, MediaAsset } from '../../api/types.ts';
import { ACTIONS } from '../../composables/app-context.ts';
import { canChange } from '../../composables/edit-lock.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import MediaLibraryDialog from '../media/MediaLibraryDialog.vue';
import { t } from '../../i18n/index.ts';
import { audioKindLabel } from '../timeline/timeline-model.ts';
import StudioIcon from '../../ui/StudioIcon.vue';
import ChipGroup from './ChipGroup.vue';
import { inputNumber, inputValue } from './controls.ts';
import NumberField from './NumberField.vue';

const props = defineProps<{ clip: AudioClip }>();

const workspace = useWorkspace();
const session = workspace.session;
const canEdit = computed(() => canChange(ACTIONS.edit));
const libraryOpen = ref(false);
const AUDIO_KINDS: readonly AudioKind[] = ['music', 'effect'];
const kinds = computed(() => AUDIO_KINDS.map((value) => ({ value, label: audioKindLabel(value) })));

function setVolume(event: Event): void {
  const value = inputNumber(event);
  if (value !== null) session.updateAudio(props.clip.id, { volume: Math.round(value) / 100 });
}

function setKind(kind: AudioKind): void {
  session.updateAudio(props.clip.id, { kind });
}

function replace(asset: MediaAsset): void {
  libraryOpen.value = false;
  session.updateAudio(props.clip.id, { mediaId: asset.id, media: asset });
}
</script>

<template>
  <div class="prop-body">
    <section class="prop-sec">
      <h3 class="lbl">{{ t('properties.audio.section') }}</h3>
      <div class="prop-field">
        <label class="prop-label" for="audio-name">{{ t('common.name') }}</label>
        <input id="audio-name" class="pv prop-control" type="text" maxlength="120" :value="clip.name" :disabled="!canEdit" data-testid="audio-name" @input="session.updateAudio(clip.id, { name: inputValue($event) })" />
      </div>
      <div class="prop-field">
        <span class="prop-label">{{ t('common.type') }}</span>
        <ChipGroup :options="kinds" :model-value="clip.kind" :label="t('properties.audio.audioType')" :disabled="!canEdit" testid="audio-kind" @update:model-value="setKind" />
      </div>
      <div class="prop-field">
        <span class="prop-label">{{ t('properties.audio.volume') }}</span>
        <div class="volume">
          <input type="range" class="rg" min="0" max="100" step="5" :value="Math.round(clip.volume * 100)" :aria-label="t('properties.audio.volume')" :aria-valuetext="`${Math.round(clip.volume * 100)} %`" :disabled="!canEdit" data-testid="audio-volume" @input="setVolume" />
          <span class="pv volume-value">{{ Math.round(clip.volume * 100) }} %</span>
        </div>
      </div>
      <div class="prop-field">
        <span class="prop-label">{{ t('properties.audio.file') }}</span>
        <div class="pv"><StudioIcon name="music" :size="13" /><span class="file">{{ clip.media?.name ?? t('properties.audio.noFile') }}</span></div>
        <div class="prop-buttons">
          <button type="button" class="pub" :disabled="!canEdit" data-testid="audio-replace" @click="libraryOpen = true">{{ t('common.chooseFromLibrary') }}</button>
        </div>
      </div>
    </section>

    <section class="prop-sec">
      <h3 class="lbl">{{ t('common.time') }}</h3>
      <div class="prop-row">
        <div class="prop-field">
          <span class="prop-label">{{ t('common.startsAt') }}</span>
          <NumberField :model-value="clip.startsAtS" :label="t('common.startsAtSecond')" unit="s" :min="0" :step="0.5" :disabled="!canEdit" testid="audio-start" @update:model-value="session.updateAudio(clip.id, { startsAtS: $event })" />
        </div>
        <div class="prop-field">
          <span class="prop-label">{{ t('common.duration') }}</span>
          <NumberField :model-value="clip.durationS" :label="t('common.durationSeconds')" unit="s" :min="0.5" :step="0.5" :disabled="!canEdit" testid="audio-duration" @update:model-value="session.updateAudio(clip.id, { durationS: $event })" />
        </div>
      </div>
    </section>

    <button v-if="canEdit" type="button" class="prop-danger" data-testid="audio-delete" @click="session.deleteAudio(clip.id)">{{ t('properties.audio.delete') }}</button>
    <MediaLibraryDialog v-if="libraryOpen" selectable mime-filter="audio/" @close="libraryOpen = false" @select="replace" />
  </div>
</template>

<style scoped>
.volume { display: flex; align-items: center; gap: 10px; }
.volume-value { min-height: 26px; min-width: 56px; padding: 2px 8px; justify-content: center; font-variant-numeric: tabular-nums; }
.file { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pub:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
