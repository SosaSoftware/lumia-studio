<script setup lang="ts">
import { computed } from 'vue';
import type { Pause, PauseEnd, Slide } from '../../api/types.ts';
import { ACTIONS } from '../../composables/app-context.ts';
import { canChange } from '../../composables/edit-lock.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import { PAUSE_END_LABELS } from '../timeline/timeline-model.ts';
import ChipGroup from './ChipGroup.vue';
import { inputValue } from './controls.ts';
import NumberField from './NumberField.vue';

const props = defineProps<{ pause: Pause; slide: Slide }>();

const workspace = useWorkspace();
const session = workspace.session;
const canEdit = computed(() => canChange(ACTIONS.edit));
const timers = computed(() => props.slide.elements.filter((element) => element.component === 'timer'));
const PAUSE_ENDS: readonly PauseEnd[] = ['continue', 'wait_click'];
const ends = PAUSE_ENDS.map((value) => ({ value, label: PAUSE_END_LABELS[value] }));
const showTimer = computed(() => props.pause.timerElementId !== null);
const timerOptions = [
  { value: true, label: 'Sí' },
  { value: false, label: 'No' },
];

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
      <h3 class="lbl">Pausa (tiempo muerto)</h3>
      <div class="prop-field">
        <label class="prop-label" for="pause-message">Mensaje</label>
        <input id="pause-message" class="pv prop-control" type="text" maxlength="200" :value="pause.message" :disabled="!canEdit" data-testid="pause-message" @input="session.updatePause(pause.id, { message: inputValue($event) })" />
      </div>
      <div class="prop-row">
        <div class="prop-field">
          <span class="prop-label">Empieza en</span>
          <NumberField :model-value="pause.startsAtS" label="Empieza en el segundo" unit="s" :min="0" :step="0.5" :disabled="!canEdit" testid="pause-start" @update:model-value="session.updatePause(pause.id, { startsAtS: $event })" />
        </div>
        <div class="prop-field">
          <span class="prop-label">Duración</span>
          <NumberField :model-value="pause.durationS" label="Duración en segundos" unit="s" :min="1" :step="1" :disabled="!canEdit" testid="pause-duration" @update:model-value="session.updatePause(pause.id, { durationS: $event })" />
        </div>
      </div>
      <div class="prop-field">
        <span class="prop-label">Mostrar temporizador</span>
        <ChipGroup :options="timerOptions" :model-value="showTimer" label="Mostrar temporizador" :disabled="!canEdit || timers.length === 0" testid="pause-timer" @update:model-value="setShowTimer" />
        <span v-if="timers.length === 0" class="prop-hint">Agrega un Temporizador a la diapositiva para mostrarlo durante la pausa.</span>
        <select
          v-else-if="showTimer && timers.length > 1"
          class="pv prop-control"
          aria-label="Temporizador"
          :value="pause.timerElementId ?? ''"
          :disabled="!canEdit"
          @change="session.updatePause(pause.id, { timerElementId: inputValue($event) })"
        >
          <option v-for="timer in timers" :key="timer.id" :value="timer.id">{{ timer.name }}</option>
        </select>
      </div>
      <div class="prop-field">
        <span class="prop-label">Al terminar</span>
        <ChipGroup :options="ends" :model-value="pause.onEnd" label="Al terminar" :disabled="!canEdit" testid="pause-end" @update:model-value="setEnd" />
      </div>
    </section>
    <button v-if="canEdit" type="button" class="prop-danger" data-testid="pause-delete" @click="session.deletePause(pause.id)">Eliminar la pausa</button>
  </div>
</template>
