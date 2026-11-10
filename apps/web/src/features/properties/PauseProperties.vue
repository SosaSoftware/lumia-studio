<script setup lang="ts">
import { computed } from 'vue';
import type { Pause, PauseEnd, Slide } from '../../api/types.ts';
import { ACTIONS } from '../../composables/app-context.ts';
import { canChange } from '../../composables/edit-lock.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import { t } from '../../i18n/index.ts';
import { pauseEndLabel } from '../timeline/timeline-model.ts';
import ChipGroup from './ChipGroup.vue';
import { inputValue } from './controls.ts';
import NumberField from './NumberField.vue';

const props = defineProps<{ pause: Pause; slide: Slide }>();

const workspace = useWorkspace();
const session = workspace.session;
const canEdit = computed(() => canChange(ACTIONS.edit));
const timers = computed(() => props.slide.elements.filter((element) => element.component === 'timer'));
const PAUSE_ENDS: readonly PauseEnd[] = ['continue', 'wait_click'];
const ends = computed(() => PAUSE_ENDS.map((value) => ({ value, label: pauseEndLabel(value) })));
const showTimer = computed(() => props.pause.timerElementId !== null);
const timerOptions = computed(() => [
  { value: true, label: t('common.yes') },
  { value: false, label: t('common.no') },
]);

function setShowTimer(show: boolean): void {
  session.updatePause(props.pause.id, { timerElementId: show ? (timers.value[0]?.id ?? null) : null });
}

function setEnd(onEnd: PauseEnd): void {
  session.updatePause(props.pause.id, { onEnd });
}
</script>

<template>
  <div class="prop-body">
    <section class="prop-sec">
      <h3 class="lbl">{{ t('properties.pause.section') }}</h3>
      <div class="prop-field">
        <label class="prop-label" for="pause-message">{{ t('properties.pause.message') }}</label>
        <input id="pause-message" class="pv prop-control" type="text" maxlength="200" :value="pause.message" :disabled="!canEdit" data-testid="pause-message" @input="session.updatePause(pause.id, { message: inputValue($event) })" />
      </div>
      <div class="prop-row">
        <div class="prop-field">
          <span class="prop-label">{{ t('common.startsAt') }}</span>
          <NumberField :model-value="pause.startsAtS" :label="t('common.startsAtSecond')" unit="s" :min="0" :step="0.5" :disabled="!canEdit" testid="pause-start" @update:model-value="session.updatePause(pause.id, { startsAtS: $event })" />
        </div>
        <div class="prop-field">
          <span class="prop-label">{{ t('common.duration') }}</span>
          <NumberField :model-value="pause.durationS" :label="t('common.durationSeconds')" unit="s" :min="1" :step="1" :disabled="!canEdit" testid="pause-duration" @update:model-value="session.updatePause(pause.id, { durationS: $event })" />
        </div>
      </div>
      <div class="prop-field">
        <span class="prop-label">{{ t('properties.pause.showTimer') }}</span>
        <ChipGroup :options="timerOptions" :model-value="showTimer" :label="t('properties.pause.showTimer')" :disabled="!canEdit || timers.length === 0" testid="pause-timer" @update:model-value="setShowTimer" />
        <span v-if="timers.length === 0" class="prop-hint">{{ t('properties.pause.needTimer') }}</span>
        <select
          v-else-if="showTimer && timers.length > 1"
          class="pv prop-control"
          :aria-label="t('properties.pause.timer')"
          :value="pause.timerElementId ?? ''"
          :disabled="!canEdit"
          @change="session.updatePause(pause.id, { timerElementId: inputValue($event) })"
        >
          <option v-for="timer in timers" :key="timer.id" :value="timer.id">{{ timer.name }}</option>
        </select>
      </div>
      <div class="prop-field">
        <span class="prop-label">{{ t('properties.pause.onEnd') }}</span>
        <ChipGroup :options="ends" :model-value="pause.onEnd" :label="t('properties.pause.onEnd')" :disabled="!canEdit" testid="pause-end" @update:model-value="setEnd" />
      </div>
    </section>
    <button v-if="canEdit" type="button" class="prop-danger" data-testid="pause-delete" @click="session.deletePause(pause.id)">{{ t('properties.pause.delete') }}</button>
  </div>
</template>
