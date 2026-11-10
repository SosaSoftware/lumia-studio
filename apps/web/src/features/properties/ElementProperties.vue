<script setup lang="ts">
import { computed } from 'vue';
import { ENTRANCES } from '../../api/types.ts';
import type { Entrance, MediaAsset, Slide, SlideElement } from '../../api/types.ts';
import { ACTIONS } from '../../composables/app-context.ts';
import { canChange } from '../../composables/edit-lock.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import { ENTRANCE_LABELS } from '../timeline/timeline-model.ts';
import { tagGroup } from '../palette/palette.ts';
import ChipGroup from './ChipGroup.vue';
import { inputValue } from './controls.ts';
import NumberField from './NumberField.vue';
import SchemaForm from './SchemaForm.vue';

const props = defineProps<{ element: SlideElement; slide: Slide }>();

const workspace = useWorkspace();
const session = workspace.session;
const canEdit = computed(() => canChange(ACTIONS.edit));
const info = computed(() => workspace.catalog.component(props.element.component));
/** The height of the component is the height of its content, so it is not typed. */
const fitsContent = computed(() => workspace.catalog.fitsContent(props.element.component));
const tag = computed(() => (info.value === undefined ? props.element.component : `${tagGroup(info.value.group)} · ${info.value.name}`));
const errors = computed(() => session.state.fieldErrors[props.element.id] ?? {});
const propErrors = computed(() => {
  const result: Record<string, string> = {};
  for (const [path, message] of Object.entries(errors.value)) {
    if (path.startsWith('props.')) result[path.slice('props.'.length)] = message;
  }
  return result;
});
const generalError = computed(() => errors.value.general ?? errors.value.props ?? '');
const entrances = ENTRANCES.map((value) => ({ value, label: ENTRANCE_LABELS[value] }));
const mediaAccept = computed(() => {
  switch (props.element.component) {
    case 'video':
      return 'video/*';
    case 'audio':
      return 'audio/*';
    default:
      return 'image/*';
  }
});

function patch(field: 'x' | 'y' | 'w' | 'h' | 'appearsAtS', value: number): void {
  session.updateElement(props.element.id, { [field]: value });
}

function setEntrance(value: Entrance): void {
  session.updateElement(props.element.id, { entrance: value });
}

function setProps(next: Record<string, unknown>): void {
  session.updateElement(props.element.id, { props: next });
}

function onMedia(asset: MediaAsset | null): void {
  session.setElementMedia(props.element.id, asset);
}
</script>

<template>
  <div class="prop-body">
    <section class="prop-sec">
      <h3 class="lbl">Elemento</h3>
      <div class="prop-field">
        <span class="prop-label">Componente</span>
        <div class="pv" data-testid="prop-component">{{ tag }}</div>
      </div>
      <div class="prop-field">
        <label class="prop-label" for="prop-name">Nombre</label>
        <input id="prop-name" class="pv prop-control" type="text" maxlength="80" :value="element.name" :disabled="!canEdit" data-testid="prop-name" @input="session.updateElement(element.id, { name: inputValue($event) })" />
      </div>
      <div class="prop-field">
        <span class="prop-label">Posición</span>
        <div class="prop-row">
          <NumberField :model-value="element.x" label="Posición horizontal" prefix="x" :step="0.5" :disabled="!canEdit" :invalid="!!errors.geometry" testid="prop-x" @update:model-value="patch('x', $event)" />
          <NumberField :model-value="element.y" label="Posición vertical" prefix="y" :step="0.5" :disabled="!canEdit" :invalid="!!errors.geometry" testid="prop-y" @update:model-value="patch('y', $event)" />
        </div>
      </div>
      <div class="prop-field">
        <span class="prop-label">Tamaño</span>
        <div class="prop-row">
          <NumberField :model-value="element.w" label="Ancho" prefix="ancho" :step="0.5" :disabled="!canEdit" :invalid="!!errors.geometry" testid="prop-w" @update:model-value="patch('w', $event)" />
          <NumberField :model-value="element.h" label="Alto" prefix="alto" :step="0.5" :disabled="!canEdit || fitsContent" :title="fitsContent ? 'El alto se ajusta al contenido' : undefined" :invalid="!!errors.geometry" testid="prop-h" @update:model-value="patch('h', $event)" />
        </div>
        <span v-if="errors.geometry" class="prop-error" role="alert" data-testid="field-error-geometry">{{ errors.geometry }}</span>
      </div>
    </section>

    <section class="prop-sec">
      <h3 class="lbl">Animación de entrada</h3>
      <div class="prop-field">
        <span class="prop-label">Efecto</span>
        <ChipGroup :options="entrances" :model-value="element.entrance" label="Animación de entrada" :disabled="!canEdit" testid="prop-entrance" @update:model-value="setEntrance" />
      </div>
      <div class="prop-row">
        <div class="prop-field">
          <span class="prop-label">Aparece en</span>
          <NumberField :model-value="element.appearsAtS" label="Aparece en el segundo" unit="s" :min="0" :step="0.1" :disabled="!canEdit" :invalid="!!errors.appearsAtS" testid="prop-appears" @update:model-value="patch('appearsAtS', $event)" />
        </div>
        <div class="prop-field">
          <span class="prop-label">Duración</span>
          <div class="pv prop-readonly" aria-readonly="true">0.5 s</div>
        </div>
      </div>
      <span v-if="errors.appearsAtS" class="prop-error" role="alert" data-testid="field-error-appearsAtS">{{ errors.appearsAtS }}</span>
    </section>

    <section v-if="info" class="prop-sec">
      <h3 class="lbl">Contenido</h3>
      <SchemaForm
        :schema="info.propsSchema"
        :model-value="element.props"
        :component="element.component"
        :errors="propErrors"
        :disabled="!canEdit"
        :can-upload="canChange(ACTIONS.upload)"
        :media="element.media"
        :media-accept="mediaAccept"
        :elements="slide.elements"
        :element-id="element.id"
        @update:model-value="setProps"
        @media="onMedia"
      />
      <span v-if="generalError" class="prop-error" role="alert" data-testid="field-error-general">{{ generalError }}</span>
    </section>

    <button v-if="canEdit" type="button" class="prop-danger" data-testid="prop-delete-element" @click="session.deleteElement(element.id)">Eliminar el elemento</button>
  </div>
</template>
