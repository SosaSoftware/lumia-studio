<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { NarrationClip } from '../../api/types.ts';
import { ACTIONS } from '../../composables/app-context.ts';
import { canChange, changeDenial } from '../../composables/edit-lock.ts';
import { t } from '../../i18n/index.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import {
  MAX_SCRIPT_LENGTH,
  narrationStatusLabel,
  formatSpeed,
  narrationDuration,
  sliderFromSpeed,
  speedFromSlider,
} from '../timeline/timeline-model.ts';
import StudioIcon from '../../ui/StudioIcon.vue';
import { inputNumber, inputValue } from './controls.ts';
import NumberField from './NumberField.vue';

const props = defineProps<{ clip: NarrationClip }>();

const workspace = useWorkspace();
const session = workspace.session;
const voices = workspace.voices;
void voices.load();
/** Only voices that Polly lists can be picked; a voice Polly no longer lists shows as missing. */
const listed = computed(() => voices.choices.value.some((voice) => voice.id === props.clip.voice));
const missingVoice = computed(() => props.clip.voice !== null && voices.choices.value.length > 0 && !listed.value);
const voicePlaceholder = computed(() => {
  if (voices.loading.value) return t('properties.narration.loadingVoices');
  if (voices.choices.value.length === 0) return t('properties.narration.noVoices');
  return t('properties.narration.chooseVoice');
});
const canEdit = computed(() => canChange(ACTIONS.edit));
const canGenerate = computed(() => canChange(ACTIONS.narration));
const playing = ref(false);
let audio: HTMLAudioElement | null = null;

const duration = computed(() => narrationDuration(props.clip));
const hasVoice = computed(() => props.clip.status === 'ready' && props.clip.audioUrl !== null);
const generateLabel = computed(() => (props.clip.status === 'ready' ? t('properties.narration.regenerate') : t('properties.narration.generate')));
const canRunGeneration = computed(() => canGenerate.value && props.clip.script.trim() !== '' && listed.value && props.clip.status !== 'generating');
const generateTip = computed(() => {
  if (!canGenerate.value) return changeDenial('properties.narration.noPermission');
  if (props.clip.script.trim() === '') return t('properties.narration.writeFirst');
  if (!listed.value) return t('properties.narration.chooseFirst');
  return t('properties.narration.generateTip');
});
const STATUS_COLORS: Record<NarrationClip['status'], string> = { pending: 'var(--s-text-2)', generating: 'var(--s-accent-fg)', ready: 'var(--s-ok)', failed: 'var(--s-danger)' };

function stop(): void {
  audio?.pause();
  audio = null;
  playing.value = false;
}

function listen(): void {
  if (playing.value) {
    stop();
    return;
  }
  if (props.clip.audioUrl === null) return;
  audio = new Audio(props.clip.audioUrl);
  audio.playbackRate = props.clip.speed;
  audio.addEventListener('ended', stop);
  playing.value = true;
  audio.play().catch(() => {
    playing.value = false;
  });
}

function generate(): void {
  if (!canRunGeneration.value) return;
  stop();
  void session.generateNarration(props.clip.id);
}

function setSpeed(event: Event): void {
  const position = inputNumber(event);
  if (position !== null) session.updateNarration(props.clip.id, { speed: speedFromSlider(position) });
}

watch(() => props.clip.id, stop);
onBeforeUnmount(stop);
</script>

<template>
  <div class="prop-body">
    <section class="prop-sec">
      <h3 class="lbl">{{ t('properties.narration.script') }}</h3>
      <div class="prop-field">
        <span class="prop-label-row">
          <label class="prop-label" for="narration-script">{{ t('properties.narration.whatVoiceSays') }}</label>
          <span class="prop-hint">{{ clip.script.length }}/{{ MAX_SCRIPT_LENGTH }}</span>
        </span>
        <textarea
          id="narration-script"
          class="pa"
          rows="6"
          :maxlength="MAX_SCRIPT_LENGTH"
          :placeholder="t('properties.narration.placeholder')"
          :value="clip.script"
          :disabled="!canEdit"
          data-testid="narration-script"
          @input="session.updateNarration(clip.id, { script: inputValue($event) })"
        ></textarea>
      </div>
      <div class="status" data-testid="narration-status" :data-status="clip.status">
        <span class="dot" :style="{ background: STATUS_COLORS[clip.status] }"></span>
        <span>{{ narrationStatusLabel(clip.status) }}</span>
      </div>
      <p v-if="clip.status === 'failed' && clip.errorMessage" class="prop-error" role="alert" data-testid="narration-error">{{ clip.errorMessage }}</p>
      <div class="prop-buttons">
        <button type="button" class="prv" :aria-disabled="!hasVoice" :title="hasVoice ? t('properties.narration.listenTip') : t('properties.narration.noVoiceYet')" data-testid="narration-listen" @click="hasVoice && listen()">
          <StudioIcon :name="playing ? 'pause' : 'play'" :size="12" />{{ playing ? t('properties.narration.stop') : t('properties.narration.listen') }}
        </button>
        <button type="button" class="pub" :aria-disabled="!canRunGeneration" :title="generateTip" data-testid="narration-generate" @click="generate">
          {{ clip.status === 'generating' ? t('properties.narration.generating') : generateLabel }}
        </button>
      </div>
    </section>

    <section class="prop-sec">
      <h3 class="lbl">{{ t('properties.narration.voiceSection') }}</h3>
      <div class="prop-field">
        <label class="prop-label" for="narration-voice">{{ t('properties.narration.voiceSection') }}</label>
        <select
          id="narration-voice"
          class="pv prop-control"
          :value="listed ? clip.voice : ''"
          :disabled="!canEdit || voices.choices.value.length === 0"
          data-testid="narration-voice"
          @change="session.updateNarration(clip.id, { voice: inputValue($event) })"
        >
          <option value="" disabled>{{ voicePlaceholder }}</option>
          <option v-for="voice in voices.choices.value" :key="voice.id" :value="voice.id">{{ voice.label }}</option>
        </select>
        <span v-if="voices.error.value" class="prop-hint error" role="alert" data-testid="narration-voices-error">{{ voices.error.value }}</span>
        <span v-else-if="missingVoice" class="prop-hint error" role="alert" data-testid="narration-voice-missing">{{ t('properties.narration.voiceMissing', { voice: clip.voice ?? '' }) }}</span>
      </div>
      <div class="prop-field">
        <span class="prop-label">{{ t('properties.narration.speed') }}</span>
        <div class="speed">
          <input
            type="range"
            class="rg"
            min="0"
            max="100"
            step="1"
            :value="sliderFromSpeed(clip.speed)"
            :aria-label="t('properties.narration.speed')"
            :aria-valuetext="formatSpeed(clip.speed)"
            :disabled="!canEdit"
            data-testid="narration-speed"
            @input="setSpeed"
          />
          <span class="pv speed-value" data-testid="narration-speed-value">{{ formatSpeed(clip.speed) }}</span>
        </div>
        <div class="scale" aria-hidden="true"><span>0.1x</span><span>1x</span><span>2x</span></div>
      </div>
    </section>

    <section class="prop-sec">
      <h3 class="lbl">{{ t('common.time') }}</h3>
      <div class="prop-field">
        <span class="prop-label">{{ t('common.startsAt') }}</span>
        <NumberField :model-value="clip.startsAtS" :label="t('common.startsAtSecond')" unit="s" :min="0" :step="0.5" :disabled="!canEdit" testid="narration-start" @update:model-value="session.updateNarration(clip.id, { startsAtS: $event })" />
      </div>
      <div class="prop-field">
        <span class="prop-label">{{ t('common.duration') }}</span>
        <div class="pv" aria-readonly="true" data-testid="narration-duration">
          <span role="img" :aria-label="t('properties.narration.readOnly')" :title="t('properties.narration.readOnly')" class="lock"><StudioIcon name="lock" :size="13" :stroke="2" /></span>
          <span>{{ duration }} s</span>
        </div>
        <span class="prop-hint">{{ clip.generatedDurationS && clip.generatedDurationS > 0 ? t('properties.narration.durationGenerated') : t('properties.narration.durationEstimated') }}</span>
      </div>
    </section>

    <button v-if="canEdit" type="button" class="prop-danger" data-testid="narration-delete" @click="session.deleteNarration(clip.id)">{{ t('properties.narration.delete') }}</button>
  </div>
</template>

<style scoped>
.status { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--s-text-2); }
.dot { width: 7px; height: 7px; border-radius: 50%; }
.speed { display: flex; align-items: center; gap: 10px; }
.speed-value { min-height: 26px; min-width: 48px; padding: 2px 8px; justify-content: center; font-variant-numeric: tabular-nums; }
.scale { display: flex; justify-content: space-between; margin-right: 58px; font-size: 11px; color: var(--s-text-2); }
.lock { display: flex; color: var(--s-text-2); }
.pa { color: var(--s-text); }
.pa:focus { outline: none; border-color: var(--s-active); }
</style>
