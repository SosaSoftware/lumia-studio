<script setup lang="ts">
import { computed } from 'vue';
import { ICON_NAMES, THEME_COLOR_KEYS } from '@lumia/packages/catalog';
import { list, rec, str } from '../../api/decode.ts';
import type { MediaAsset, MediaRef, SlideElement } from '../../api/types.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import { CONTENT_ICON_LABELS, contentIcon } from '../slide-components/content-icons.ts';
import ChipGroup from './ChipGroup.vue';
import ColorSwatches from './ColorSwatches.vue';
import { inputValue } from './controls.ts';
import MediaPicker from './MediaPicker.vue';
import NumberField from './NumberField.vue';
import { booleanLabels, valueLabel } from './prop-labels.ts';
import { blankItem, errorKey } from './schema-form-model.ts';
import type { FieldDescriptor, FieldPath } from './schema-form-model.ts';

const props = defineProps<{
  field: FieldDescriptor;
  path: FieldPath;
  value: unknown;
  /** All props of the element, for fields that refer to other fields (the correct option, for example). */
  root: Record<string, unknown>;
  component: string;
  errors: Readonly<Record<string, string>>;
  disabled: boolean;
  canUpload: boolean;
  media: MediaRef | null;
  mediaAccept?: string;
  elements: readonly SlideElement[];
  elementId: string;
}>();

const emit = defineEmits<{
  change: [path: FieldPath, value: unknown];
  media: [asset: MediaAsset | null];
}>();

const workspace = useWorkspace();
const key = computed(() => errorKey(props.path));
const inputId = computed(() => `field-${key.value}`);
const error = computed(() => props.errors[key.value]);
const items = computed(() => list(props.value));
const textValue = computed(() => (typeof props.value === 'string' ? props.value : ''));
const counter = computed(() =>
  props.field.kind === 'text' && props.field.maxLength !== null ? `${String(textValue.value.length)}/${String(props.field.maxLength)}` : '',
);

/** Fields whose value is the id of something else: they get a select of those things. */
const references = computed<{ value: string; label: string }[] | null>(() => {
  const name = props.field.key;
  if (props.component === 'multiple_choice' && name === 'correctOptionId') {
    return list(props.root.options).map((item, index) => {
      const option = rec(item);
      return { value: str(option.id), label: `${String.fromCharCode(65 + index)} · ${str(option.text)}` };
    });
  }
  if (props.component === 'drag_drop' && name === 'correctItemId') {
    return list(props.root.items).map((item) => ({ value: str(rec(item).id), label: str(rec(item).text) }));
  }
  if (props.component === 'diagram' && (name === 'from' || name === 'to')) {
    return list(props.root.nodes).map((item) => ({ value: str(rec(item).id), label: str(rec(item).text) }));
  }
  if (props.component === 'connector' && (name === 'fromElementId' || name === 'toElementId')) {
    return [
      { value: '', label: 'Sin conectar' },
      ...props.elements.filter((element) => element.id !== props.elementId && element.component !== 'connector').map((element) => ({ value: element.id, label: element.name })),
    ];
  }
  return null;
});

/**
 * The element medium is the top-level `mediaId`; the parent keeps it on the element so the canvas shows it at once.
 * A medium inside a list item (each image of a gallery) lives only in that item, resolved from the library.
 */
const nestedMedia = computed(() => props.path.length > 1);
const pickerMedia = computed<MediaRef | null>(() => {
  if (!nestedMedia.value) return props.media;
  return typeof props.value === 'string' && props.value !== '' ? workspace.media.get(props.value) : null;
});

function pickMedia(asset: MediaAsset | null): void {
  if (nestedMedia.value) emit('change', props.path, asset?.id ?? null);
  else emit('media', asset);
}

const isColor = computed(() => props.field.kind === 'enum' && props.field.options.length === THEME_COLOR_KEYS.length && THEME_COLOR_KEYS.every((name) => props.field.kind === 'enum' && props.field.options.includes(name)));
const isIcon = computed(() => props.component === 'icon' && props.field.key === 'name');
const enumOptions = computed(() => (props.field.kind === 'enum' ? props.field.options.map((option) => ({ value: option, label: valueLabel(props.component, props.field.key, option) })) : []));
const booleanOptions = computed(() => {
  const [yes, no] = booleanLabels(props.component, props.field.key);
  return [
    { value: true, label: yes },
    { value: false, label: no },
  ];
});

function setText(event: Event): void {
  emit('change', props.path, inputValue(event));
}

function setItem(index: number, value: string): void {
  emit('change', props.path, items.value.map((item, position) => (position === index ? value : item)));
}

function addString(): void {
  emit('change', props.path, [...items.value, 'Nuevo elemento']);
}

function addObject(): void {
  if (props.field.kind === 'object-list') emit('change', props.path, [...items.value, blankItem(props.field.fields, items.value)]);
}

function remove(index: number): void {
  emit('change', props.path, items.value.filter((_, position) => position !== index));
}

const canAdd = computed(() => {
  const field = props.field;
  return (field.kind === 'string-list' || field.kind === 'object-list') && (field.maxItems === null || items.value.length < field.maxItems);
});
const canRemove = computed(() => {
  const field = props.field;
  return (field.kind === 'string-list' || field.kind === 'object-list') && items.value.length > field.minItems;
});

function itemTitle(item: unknown, index: number): string {
  const record = rec(item);
  const text = str(record.text) || str(record.title) || str(record.label) || str(record.left);
  return text === '' ? String(index + 1) : `${String(index + 1)} · ${text}`;
}
</script>

<template>
  <div class="field" :data-testid="`schema-field-${key}`">
    <template v-if="references">
      <label :for="inputId" class="label">{{ field.label }}</label>
      <select :id="inputId" class="pv select" :value="str(value)" :disabled="disabled" :aria-invalid="!!error" :data-testid="inputId" @change="setText">
        <option v-for="option in references" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
    </template>

    <template v-else-if="field.kind === 'text'">
      <span class="label-row">
        <label :for="inputId" class="label">{{ field.label }}</label>
        <span v-if="counter" class="counter">{{ counter }}</span>
      </span>
      <textarea
        v-if="field.multiline"
        :id="inputId"
        class="pa"
        rows="4"
        :value="textValue"
        :maxlength="field.maxLength ?? undefined"
        :disabled="disabled"
        :aria-invalid="!!error"
        :aria-describedby="error ? `${inputId}-error` : undefined"
        :data-testid="inputId"
        @input="setText"
      ></textarea>
      <input
        v-else
        :id="inputId"
        class="pv control"
        type="text"
        :value="textValue"
        :maxlength="field.maxLength ?? undefined"
        :disabled="disabled"
        :aria-invalid="!!error"
        :aria-describedby="error ? `${inputId}-error` : undefined"
        :data-testid="inputId"
        @input="setText"
      />
    </template>

    <template v-else-if="field.kind === 'number'">
      <span class="label">{{ field.label }}</span>
      <NumberField
        :model-value="typeof value === 'number' ? value : 0"
        :label="field.label"
        :min="field.min ?? undefined"
        :max="field.max ?? undefined"
        :step="field.integer ? 1 : 0.1"
        :disabled="disabled"
        :invalid="!!error"
        :testid="inputId"
        @update:model-value="emit('change', path, $event)"
      />
    </template>

    <template v-else-if="field.kind === 'boolean'">
      <span class="label">{{ field.label }}</span>
      <ChipGroup :options="booleanOptions" :model-value="value === true" :label="field.label" :disabled="disabled" :testid="inputId" @update:model-value="emit('change', path, $event)" />
    </template>

    <template v-else-if="field.kind === 'enum'">
      <span class="label">{{ field.label }}</span>
      <ColorSwatches v-if="isColor" :model-value="str(value)" :label="field.label" :soft="component === 'shape' && field.key === 'fill'" :disabled="disabled" :testid="inputId" @update:model-value="emit('change', path, $event)" />
      <div v-else-if="isIcon" class="icons" role="radiogroup" :aria-label="field.label" :data-testid="inputId">
        <button
          v-for="name in ICON_NAMES"
          :key="name"
          type="button"
          class="icon-option"
          role="radio"
          :aria-checked="value === name"
          :aria-label="CONTENT_ICON_LABELS[name]"
          :title="CONTENT_ICON_LABELS[name]"
          :disabled="disabled"
          :data-testid="`${inputId}-${name}`"
          @click="emit('change', path, name)"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path v-for="(d, index) in contentIcon(name)" :key="index" :d="d" />
          </svg>
        </button>
      </div>
      <ChipGroup v-else-if="enumOptions.length <= 5" :options="enumOptions" :model-value="str(value)" :label="field.label" :disabled="disabled" :testid="inputId" @update:model-value="emit('change', path, $event)" />
      <select v-else :id="inputId" class="pv select" :value="str(value)" :disabled="disabled" :aria-invalid="!!error" :data-testid="inputId" @change="setText">
        <option v-for="option in enumOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
    </template>

    <template v-else-if="field.kind === 'string-list'">
      <span :id="`${inputId}-label`" class="label">{{ field.label }}</span>
      <div class="list" role="group" :aria-labelledby="`${inputId}-label`">
        <div v-for="(item, index) in items" :key="index" class="item">
          <input class="pv control" type="text" :aria-label="`${field.label} ${index + 1}`" :value="str(item)" :maxlength="field.itemMaxLength ?? undefined" :disabled="disabled" :aria-invalid="!!errors[`${key}.${index}`]" :data-testid="`${inputId}-${index}`" @input="setItem(index, inputValue($event))" />
          <button type="button" class="ib" :aria-label="`Quitar ${field.label} ${index + 1}`" title="Quitar" :disabled="disabled || !canRemove" :data-testid="`${inputId}-remove-${index}`" @click="remove(index)">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
          <span v-if="errors[`${key}.${index}`]" class="error" role="alert" :data-testid="`field-error-${key}.${index}`">{{ errors[`${key}.${index}`] }}</span>
        </div>
        <button type="button" class="prv add" :disabled="disabled || !canAdd" :data-testid="`${inputId}-add`" @click="addString">Agregar</button>
      </div>
    </template>

    <template v-else-if="field.kind === 'object-list'">
      <span :id="`${inputId}-label`" class="label">{{ field.label }}</span>
      <div class="list" role="group" :aria-labelledby="`${inputId}-label`">
        <fieldset v-for="(item, index) in items" :key="index" class="card">
          <legend class="legend">{{ itemTitle(item, index) }}</legend>
          <SchemaField
            v-for="child in field.fields"
            :key="child.key"
            :field="child"
            :path="[...path, index, child.key]"
            :value="rec(item)[child.key]"
            :root="root"
            :component="component"
            :errors="errors"
            :disabled="disabled"
            :can-upload="canUpload"
            :media="null"
            :elements="elements"
            :element-id="elementId"
            @change="(childPath, next) => emit('change', childPath, next)"
          />
          <button type="button" class="remove" :disabled="disabled || !canRemove" :data-testid="`${inputId}-remove-${index}`" @click="remove(index)">Quitar</button>
        </fieldset>
        <button type="button" class="prv add" :disabled="disabled || !canAdd" :data-testid="`${inputId}-add`" @click="addObject">Agregar</button>
      </div>
    </template>

    <template v-else-if="field.kind === 'media'">
      <span class="label">{{ field.label }}</span>
      <MediaPicker :id="key" :media="pickerMedia" :media-id="typeof value === 'string' ? value : null" :can-upload="canUpload" :accept="mediaAccept ?? 'image/*'" :disabled="disabled" @pick="pickMedia" />
    </template>

    <span v-if="error" :id="`${inputId}-error`" class="error" role="alert" :data-testid="`field-error-${key}`">{{ error }}</span>
  </div>
</template>

<style scoped>
.field { display: flex; flex-direction: column; gap: 5px; }
.label { font-size: 12px; color: var(--s-text-2); }
.label-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.counter { font-size: 11px; color: var(--s-text-2); font-variant-numeric: tabular-nums; }
.control { width: 100%; color: var(--s-text); font: inherit; font-size: 12px; }
.control:focus, .select:focus { outline: none; border-color: var(--s-active); }
.control[aria-invalid='true'], .pa[aria-invalid='true'], .select[aria-invalid='true'] { border-color: var(--s-danger); }
.select { width: 100%; color: var(--s-text); font: inherit; font-size: 12px; cursor: pointer; }
.pa { color: var(--s-text); }
.pa:focus { outline: none; border-color: var(--s-active); }
.list { display: flex; flex-direction: column; gap: 6px; }
.item { display: grid; grid-template-columns: 1fr auto; gap: 4px; align-items: center; }
.item .error { grid-column: 1 / -1; }
.card { margin: 0; padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 8px; border: 1px solid var(--s-border); border-radius: 8px; background: var(--s-editor); min-width: 0; }
.legend { padding: 0 4px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; color: var(--s-text-2); }
.remove { align-self: flex-start; padding: 0; background: transparent; border: 0; color: var(--s-danger); font: inherit; font-size: 12px; cursor: pointer; }
.remove:disabled { opacity: 0.4; cursor: not-allowed; }
.add { align-self: flex-start; }
.add:disabled { opacity: 0.45; cursor: not-allowed; }
.icons { display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; }
.icon-option { height: 30px; display: flex; align-items: center; justify-content: center; padding: 0; background: var(--s-input); border: 1px solid var(--s-border); border-radius: 6px; color: var(--s-text-2); cursor: pointer; }
.icon-option[aria-checked='true'] { border-color: var(--s-active); background: var(--s-active-soft); color: var(--s-text); }
.icon-option:focus-visible { outline: 2px solid var(--s-active); outline-offset: 1px; }
.error { font-size: 12px; color: var(--s-danger); }
</style>
