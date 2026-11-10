<script setup lang="ts">
import { computed } from 'vue';
import { ENTRANCES } from '../../api/types.ts';
import type { Entrance, MediaAsset, Slide, SlideElement } from '../../api/types.ts';
import { ACTIONS } from '../../composables/app-context.ts';
import { canChange } from '../../composables/edit-lock.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import { t } from '../../i18n/index.ts';
import { componentName } from '../editor/catalog-labels.ts';
import { entranceLabel } from '../timeline/timeline-model.ts';
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
const tag = computed(() => (info.value === undefined ? props.element.component : `${tagGroup(info.value.group)} · ${componentName(info.value)}`));
const errors = computed(() => session.state.fieldErrors[props.element.id] ?? {});
const propErrors = computed(() => {
  const result: Record<string, string> = {};
  for (const [path, message] of Object.entries(errors.value)) {
    if (path.startsWith('props.')) result[path.slice('props.'.length)] = message;
  }
  return result;
});
const generalError = computed(() => errors.value.general ?? errors.value.props ?? '');
const entrances = computed(() => ENTRANCES.map((value) => ({ value, label: entranceLabel(value) })));
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
      <h3 class="lbl">{{ t('properties.element.section') }}</h3>
      <div class="prop-field">
        <span class="prop-label">{{ t('properties.element.component') }}</span>
        <div class="pv" data-testid="prop-component">{{ tag }}</div>
      </div>
      <div class="prop-field">
        <label class="prop-label" for="prop-name">{{ t('common.name') }}</label>
        <input id="prop-name" class="pv prop-control" type="text" maxlength="80" :value="element.name" :disabled="!canEdit" data-testid="prop-name" @input="session.updateElement(element.id, { name: inputValue($event) })" />
      </div>
      <div class="prop-field">
        <span class="prop-label">{{ t('properties.element.position') }}</span>
        <div class="prop-row">
          <NumberField :model-value="element.x" :label="t('properties.element.horizontal')" prefix="x" :step="0.5" :disabled="!canEdit" :invalid="!!errors.geometry" testid="prop-x" @update:model-value="patch('x', $event)" />
          <NumberField :model-value="element.y" :label="t('properties.element.vertical')" prefix="y" :step="0.5" :disabled="!canEdit" :invalid="!!errors.geometry" testid="prop-y" @update:model-value="patch('y', $event)" />
        </div>
      </div>
      <div class="prop-field">
        <span class="prop-label">{{ t('properties.element.size') }}</span>
        <div class="prop-row">
          <NumberField :model-value="element.w" :label="t('properties.element.width')" :prefix="t('properties.element.widthPrefix')" :step="0.5" :disabled="!canEdit" :invalid="!!errors.geometry" testid="prop-w" @update:model-value="patch('w', $event)" />
          <NumberField :model-value="element.h" :label="t('properties.element.height')" :prefix="t('properties.element.heightPrefix')" :step="0.5" :disabled="!canEdit || fitsContent" :title="fitsContent ? t('properties.element.heightFits') : undefined" :invalid="!!errors.geometry" testid="prop-h" @update:model-value="patch('h', $event)" />
        </div>
        <span v-if="errors.geometry" class="prop-error" role="alert" data-testid="field-error-geometry">{{ errors.geometry }}</span>
      </div>
    </section>

    <section class="prop-sec">
      <h3 class="lbl">{{ t('properties.element.entranceSection') }}</h3>
      <div class="prop-field">
        <span class="prop-label">{{ t('common.effect') }}</span>
        <ChipGroup :options="entrances" :model-value="element.entrance" :label="t('properties.element.entranceSection')" :disabled="!canEdit" testid="prop-entrance" @update:model-value="setEntrance" />
      </div>
      <div class="prop-row">
        <div class="prop-field">
          <span class="prop-label">{{ t('properties.element.appearsAt') }}</span>
          <NumberField :model-value="element.appearsAtS" :label="t('properties.element.appearsAtSecond')" unit="s" :min="0" :step="0.1" :disabled="!canEdit" :invalid="!!errors.appearsAtS" testid="prop-appears" @update:model-value="patch('appearsAtS', $event)" />
        </div>
        <div class="prop-field">
          <span class="prop-label">{{ t('common.duration') }}</span>
          <div class="pv prop-readonly" aria-readonly="true">0.5 s</div>
        </div>
      </div>
      <span v-if="errors.appearsAtS" class="prop-error" role="alert" data-testid="field-error-appearsAtS">{{ errors.appearsAtS }}</span>
    </section>

    <section v-if="info" class="prop-sec">
      <h3 class="lbl">{{ t('properties.element.content') }}</h3>
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

    <button v-if="canEdit" type="button" class="prop-danger" data-testid="prop-delete-element" @click="session.deleteElement(element.id)">{{ t('properties.element.delete') }}</button>
  </div>
</template>
