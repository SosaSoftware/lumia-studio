<script setup lang="ts">
import { computed } from 'vue';
import { ENTRANCES, EXITS } from '../../api/types.ts';
import type { Entrance, Exit, MediaAsset, Slide, SlideElement } from '../../api/types.ts';
import { ACTIONS } from '../../composables/app-context.ts';
import { canChange } from '../../composables/edit-lock.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import { lang, t } from '../../i18n/index.ts';
import { BUTTON_COMPONENT, START_BUTTON_ACTION } from '@lumia/packages/catalog';
import { componentName } from '../editor/catalog-labels.ts';
import { elementDeletion } from '../editor/element-deletion.ts';
import { activeCustomButton, activeStartButton } from '../slides/slide-buttons.ts';
import { entranceLabel, exitLabel } from '../timeline/timeline-model.ts';
import { tagGroup } from '../palette/palette.ts';
import ChipGroup from './ChipGroup.vue';
import { inputValue } from './controls.ts';
import NumberField from './NumberField.vue';
import { PropertyPanelLayout } from './property-layout.ts';
import type { ElementField, PanelBlock, PanelSection } from './property-layout.ts';
import PropertySectionGroup from './PropertySectionGroup.vue';
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

/** The element is the start button its slide uses now, so it stays at second 0. */
const isStartButton = computed(() => activeStartButton(props.slide)?.id === props.element.id);

/** What the button means to its slide: its start button, its custom button, or a start button the slide does not use. */
const buttonNotice = computed(() => {
  if (props.element.component !== BUTTON_COMPONENT) return '';
  if (isStartButton.value) return t('properties.element.buttonIsStart');
  if (activeCustomButton(props.slide)?.id === props.element.id) return t('properties.element.buttonIsCustom');
  if (props.element.props.action === START_BUTTON_ACTION) return t('properties.element.startButtonUnused');
  return '';
});
const entrances = computed(() => ENTRANCES.map((value) => ({ value, label: entranceLabel(value) })));
const exits = computed(() => EXITS.map((value) => ({ value, label: exitLabel(value) })));

/** Seconds an element stays on the slide when it gets an exit and had none. */
const DEFAULT_STAY_S = 5;
const round1 = (value: number): number => Math.round(value * 10) / 10;

const elementLabels = computed<Record<ElementField, string>>(() => ({
  x: t('properties.element.position'),
  y: t('properties.element.vertical'),
  w: t('properties.element.size'),
  h: t('properties.element.height'),
  entrance: t('properties.element.entranceSection'),
  appearsAtS: t('properties.element.appearsAt'),
  exit: t('properties.element.exit'),
  disappearsAtS: t('properties.element.disappearsAt'),
}));

const sections = computed<PanelSection[]>(() => {
  const component = info.value;
  if (component === undefined) return [];
  return new PropertyPanelLayout(workspace.catalog.info.value, lang.value).build(component, props.element.props, elementLabels.value);
});

/** `y` and `h` are drawn next to `x` and `w`; alone they get their own row. */
function pairedWith(blocks: readonly PanelBlock[], field: ElementField): boolean {
  const partner = field === 'y' ? 'x' : field === 'h' ? 'w' : null;
  return partner !== null && blocks.some((block) => block.kind === 'element' && block.field === partner);
}

function hasField(blocks: readonly PanelBlock[], field: ElementField): boolean {
  return blocks.some((block) => block.kind === 'element' && block.field === field);
}

function patch(field: 'x' | 'y' | 'w' | 'h' | 'appearsAtS', value: number): void {
  const element = props.element;
  // An element that leaves keeps the time it stays on the slide when its appearance moves.
  if (field === 'appearsAtS' && element.exit !== 'none' && element.disappearsAtS !== null) {
    session.updateElement(element.id, { appearsAtS: value, disappearsAtS: round1(value + (element.disappearsAtS - element.appearsAtS)) });
    return;
  }
  session.updateElement(element.id, { [field]: value });
}

function setExit(value: Exit): void {
  const element = props.element;
  if (value === 'none') {
    session.updateElement(element.id, { exit: value, disappearsAtS: null });
    return;
  }
  session.updateElement(element.id, { exit: value, disappearsAtS: element.disappearsAtS ?? round1(element.appearsAtS + DEFAULT_STAY_S) });
}

function setDisappears(value: number): void {
  session.updateElement(props.element.id, { disappearsAtS: Math.max(value, round1(props.element.appearsAtS + 0.1)) });
}

function setEntrance(value: Entrance): void {
  session.updateElement(props.element.id, { entrance: value });
}

function setProps(next: Record<string, unknown>): void {
  // A button that becomes the start button of its slide (its action turns to "Iniciar diapositiva") moves to second 0.
  const slide = { ...props.slide, elements: props.slide.elements.map((item) => (item.id === props.element.id ? { ...item, props: next } : item)) };
  const startsNow = activeStartButton(slide)?.id === props.element.id;
  session.updateElement(props.element.id, startsNow && props.element.appearsAtS !== 0 ? { props: next, appearsAtS: 0 } : { props: next });
}

function onMedia(asset: MediaAsset | null): void {
  session.setElementMedia(props.element.id, asset);
}
</script>

<template>
  <div class="prop-body">
    <div class="prop-field identity">
      <span class="prop-label">{{ t('properties.element.component') }}</span>
      <div class="pv" data-testid="prop-component">{{ tag }}</div>
    </div>
    <div class="prop-field">
      <label class="prop-label" for="prop-name">{{ t('common.name') }}</label>
      <input id="prop-name" class="pv prop-control" type="text" maxlength="80" :value="element.name" :disabled="!canEdit" data-testid="prop-name" @input="session.updateElement(element.id, { name: inputValue($event) })" />
    </div>
    <p v-if="buttonNotice" class="prop-hint notice" data-testid="prop-button-notice">{{ buttonNotice }}</p>

    <PropertySectionGroup v-for="section in sections" :key="section.key" :section="section">
      <template #default="{ blocks }">
        <template v-for="(block, index) in blocks" :key="block.kind === 'element' ? block.field : `props-${index}`">
          <SchemaForm
            v-if="block.kind === 'props' && info"
            :schema="info.propsSchema"
            :fields="block.fields"
            :model-value="element.props"
            :component="element.component"
            :errors="propErrors"
            :disabled="!canEdit"
            :can-upload="canChange(ACTIONS.upload)"
            :media="element.media"
            :elements="slide.elements"
            :element-id="element.id"
            :slides="session.state.slides"
            @update:model-value="setProps"
            @media="onMedia"
          />


          <div v-else-if="block.kind === 'element' && block.field === 'x'" class="prop-field">
            <span class="prop-label">{{ block.label }}</span>
            <div class="prop-row">
              <NumberField :model-value="element.x" :label="t('properties.element.horizontal')" prefix="x" :step="0.5" :disabled="!canEdit" :invalid="!!errors.geometry" testid="prop-x" @update:model-value="patch('x', $event)" />
              <NumberField v-if="hasField(blocks, 'y')" :model-value="element.y" :label="t('properties.element.vertical')" prefix="y" :step="0.5" :disabled="!canEdit" :invalid="!!errors.geometry" testid="prop-y" @update:model-value="patch('y', $event)" />
            </div>
          </div>

          <div v-else-if="block.kind === 'element' && block.field === 'y' && !pairedWith(blocks, 'y')" class="prop-field">
            <span class="prop-label">{{ block.label }}</span>
            <NumberField :model-value="element.y" :label="t('properties.element.vertical')" prefix="y" :step="0.5" :disabled="!canEdit" :invalid="!!errors.geometry" testid="prop-y" @update:model-value="patch('y', $event)" />
          </div>

          <div v-else-if="block.kind === 'element' && block.field === 'w'" class="prop-field">
            <span class="prop-label">{{ block.label }}</span>
            <div class="prop-row">
              <NumberField :model-value="element.w" :label="t('properties.element.width')" :prefix="t('properties.element.widthPrefix')" :step="0.5" :disabled="!canEdit" :invalid="!!errors.geometry" testid="prop-w" @update:model-value="patch('w', $event)" />
              <NumberField v-if="hasField(blocks, 'h')" :model-value="element.h" :label="t('properties.element.height')" :prefix="t('properties.element.heightPrefix')" :step="0.5" :disabled="!canEdit || fitsContent" :title="fitsContent ? t('properties.element.heightFits') : undefined" :invalid="!!errors.geometry" testid="prop-h" @update:model-value="patch('h', $event)" />
            </div>
            <span v-if="errors.geometry" class="prop-error" role="alert" data-testid="field-error-geometry">{{ errors.geometry }}</span>
          </div>

          <div v-else-if="block.kind === 'element' && block.field === 'h' && !pairedWith(blocks, 'h')" class="prop-field">
            <span class="prop-label">{{ block.label }}</span>
            <NumberField :model-value="element.h" :label="t('properties.element.height')" :prefix="t('properties.element.heightPrefix')" :step="0.5" :disabled="!canEdit || fitsContent" :title="fitsContent ? t('properties.element.heightFits') : undefined" :invalid="!!errors.geometry" testid="prop-h" @update:model-value="patch('h', $event)" />
          </div>

          <div v-else-if="block.kind === 'element' && block.field === 'entrance'" class="prop-field">
            <span class="prop-label">{{ block.label }}</span>
            <ChipGroup :options="entrances" :model-value="element.entrance" :label="block.label" :disabled="!canEdit" testid="prop-entrance" @update:model-value="setEntrance" />
          </div>

          <div v-else-if="block.kind === 'element' && block.field === 'appearsAtS'" class="prop-row">
            <div class="prop-field">
              <span class="prop-label">{{ block.label }}</span>
              <NumberField
                :model-value="element.appearsAtS"
                :label="t('properties.element.appearsAtSecond')"
                unit="s"
                :min="0"
                :step="0.1"
                :disabled="!canEdit || isStartButton"
                :title="isStartButton ? t('properties.element.startButtonAtZero') : undefined"
                :invalid="!!errors.appearsAtS"
                testid="prop-appears"
                @update:model-value="patch('appearsAtS', $event)"
              />
              <span v-if="isStartButton" class="prop-hint" data-testid="prop-appears-locked">{{ t('properties.element.startButtonAtZero') }}</span>
              <span v-if="errors.appearsAtS" class="prop-error" role="alert" data-testid="field-error-appearsAtS">{{ errors.appearsAtS }}</span>
            </div>
            <div class="prop-field">
              <span class="prop-label">{{ t('properties.element.duration') }}</span>
              <div class="pv prop-readonly" aria-readonly="true">0.5 s</div>
            </div>
          </div>

          <div v-else-if="block.kind === 'element' && block.field === 'exit'" class="prop-field">
            <span class="prop-label">{{ block.label }}</span>
            <ChipGroup :options="exits" :model-value="element.exit" :label="block.label" :disabled="!canEdit" testid="prop-exit" @update:model-value="setExit" />
          </div>

          <div v-else-if="block.kind === 'element' && block.field === 'disappearsAtS' && element.exit !== 'none'" class="prop-field">
            <span class="prop-label">{{ block.label }}</span>
            <NumberField
              :model-value="element.disappearsAtS ?? element.appearsAtS + DEFAULT_STAY_S"
              :label="t('properties.element.disappearsAtSecond')"
              unit="s"
              :min="element.appearsAtS + 0.1"
              :step="0.1"
              :disabled="!canEdit"
              :invalid="!!errors.disappearsAtS"
              testid="prop-disappears"
              @update:model-value="setDisappears"
            />
            <span v-if="errors.disappearsAtS" class="prop-error" role="alert" data-testid="field-error-disappearsAtS">{{ errors.disappearsAtS }}</span>
          </div>
        </template>

      </template>
    </PropertySectionGroup>

    <span v-if="generalError" class="prop-error" role="alert" data-testid="field-error-general">{{ generalError }}</span>

    <button v-if="canEdit" type="button" class="prop-danger" data-testid="prop-delete-element" @click="elementDeletion.request(session.state.slides, [element.id], () => void session.deleteElement(element.id))">{{ t('properties.element.delete') }}</button>
  </div>
</template>
