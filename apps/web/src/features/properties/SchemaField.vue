<script setup lang="ts">
import { computed, ref } from 'vue';
import { ICON_NAMES, THEME_COLOR_KEYS } from '@lumia/packages/catalog';
import { list, rec, str } from '../../api/decode.ts';
import type { MediaAsset, MediaRef, Slide, SlideElement } from '../../api/types.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import { t } from '../../i18n/index.ts';
import { contentIcon, iconLabel } from '../slide-components/content-icons.ts';
import ChipGroup from './ChipGroup.vue';
import ColorSwatches from './ColorSwatches.vue';
import EmojiField from './EmojiField.vue';
import MermaidEditor from './MermaidEditor.vue';
import ShapePicker from './ShapePicker.vue';
import { inputValue } from './controls.ts';
import MediaPicker from './MediaPicker.vue';
import NumberField from './NumberField.vue';
import { booleanLabels, valueLabel } from './prop-labels.ts';
import { blankItem, errorKey, moveItem, newListText } from './schema-form-model.ts';
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
  elements: readonly SlideElement[];
  elementId: string;
  /** Slides of the class, for a field that points to one of them. */
  slides?: readonly Slide[];
  /** For a list of items: the top-level field that marks one of them as correct, drawn as a choice on each item. */
  mark?: { key: string; label: string; valueKey: string; value: string } | null;
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
  const target = props.field.ref;
  if (target === null) return null;
  if (target.kind === 'slides') {
    if (target.when !== null && props.root[target.when.prop] !== target.when.value) return null;
    return [
      { value: '', label: t('properties.schema.chooseSlide') },
      ...(props.slides ?? []).map((slide) => ({ value: String(slide.position), label: `${String(slide.position)} · ${slide.title === '' ? t('properties.schema.untitledSlide') : slide.title}` })),
    ];
  }
  if (target.kind === 'slideElements') {
    return [
      { value: '', label: t('properties.schema.unconnected') },
      ...props.elements.filter((element) => element.id !== props.elementId && element.component !== 'connector' && element.component !== 'arrow').map((element) => ({ value: element.id, label: element.name })),
    ];
  }
  return list(props.root[target.list]).map((item, index) => {
    const option = rec(item);
    const label = str(option[target.label]);
    return { value: str(option[target.value]), label: target.letters ? `${String.fromCharCode(65 + index)} · ${label}` : label };
  });
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
const isShape = computed(() => props.field.control === 'shape');
const isIcon = computed(() => props.field.control === 'icon');
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
  const field = props.field;
  emit('change', props.path, [...items.value, field.kind === 'string-list' && field.itemEmojiSet !== null ? '⭐' : newListText(props.component, field.key, field.kind === 'string-list' ? field.itemMaxLength : null)]);
}

function addObject(): void {
  if (props.field.kind === 'object-list') emit('change', props.path, [...items.value, blankItem(props.field.fields, items.value)]);
}

function remove(index: number): void {
  emit('change', props.path, items.value.filter((_, position) => position !== index));
  collapsed.value = new Set();
}

function move(index: number, offset: number): void {
  emit('change', props.path, moveItem(items.value, index, index + offset));
  collapsed.value = new Set();
}

/** Items of a list of objects whose fields are hidden; the person folds them to keep long lists short. */
const collapsed = ref<ReadonlySet<number>>(new Set());

function toggle(index: number): void {
  const next = new Set(collapsed.value);
  if (next.has(index)) next.delete(index);
  else next.add(index);
  collapsed.value = next;
}

function markValue(item: unknown): string {
  return props.mark === null || props.mark === undefined ? '' : str(rec(item)[props.mark.valueKey]);
}

function setMark(item: unknown): void {
  if (props.mark !== null && props.mark !== undefined) emit('change', [props.mark.key], markValue(item));
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
  <div v-if="!field.auto" class="field" :data-testid="`schema-field-${key}`">
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

    <template v-else-if="field.kind === 'code'">
      <span class="label">{{ field.label }}</span>
      <MermaidEditor :model-value="textValue" :editor="field.editor" :root="root" :label="field.label" :disabled="disabled" :invalid="!!error" :testid="inputId" @update:model-value="emit('change', path, $event)" />
    </template>

    <template v-else-if="field.kind === 'emoji'">
      <span class="label">{{ field.label }}</span>
      <EmojiField :model-value="textValue" :label="field.label" :set="field.set" :disabled="disabled" :testid="inputId" @update:model-value="emit('change', path, $event)" />
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
      <ColorSwatches v-if="isColor" :model-value="str(value)" :label="field.label" :soft="component === 'shape' && field.key === 'fill' && (root.variant === undefined || root.variant === 'soft')" :disabled="disabled" :testid="inputId" @update:model-value="emit('change', path, $event)" />
      <ShapePicker v-else-if="isShape && field.kind === 'enum'" :model-value="str(value)" :label="field.label" :options="field.options" :disabled="disabled" :testid="inputId" @update:model-value="emit('change', path, $event)" />
      <div v-else-if="isIcon" class="icons" role="radiogroup" :aria-label="field.label" :data-testid="inputId">
        <button
          v-for="name in ICON_NAMES"
          :key="name"
          type="button"
          class="icon-option"
          role="radio"
          :aria-checked="value === name"
          :aria-label="iconLabel(name)"
          :title="iconLabel(name)"
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
          <EmojiField v-if="field.itemEmojiSet !== null" :model-value="str(item)" :label="`${field.label} ${index + 1}`" :set="field.itemEmojiSet" :disabled="disabled" :testid="`${inputId}-${index}`" @update:model-value="setItem(index, $event)" />
          <input v-else class="pv control" type="text" :aria-label="`${field.label} ${index + 1}`" :value="str(item)" :maxlength="field.itemMaxLength ?? undefined" :disabled="disabled" :aria-invalid="!!errors[`${key}.${index}`]" :data-testid="`${inputId}-${index}`" @input="setItem(index, inputValue($event))" />
          <span class="item-actions">
            <button type="button" class="ib" :aria-label="t('properties.schema.moveUp', { label: field.label, index: index + 1 })" :disabled="disabled || index === 0" :data-testid="`${inputId}-up-${index}`" @click="move(index, -1)">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6" /></svg>
            </button>
            <button type="button" class="ib" :aria-label="t('properties.schema.moveDown', { label: field.label, index: index + 1 })" :disabled="disabled || index === items.length - 1" :data-testid="`${inputId}-down-${index}`" @click="move(index, 1)">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </button>
          <button type="button" class="ib" :aria-label="t('properties.schema.removeItem', { label: field.label, index: index + 1 })" :title="t('common.remove')" :disabled="disabled || !canRemove" :data-testid="`${inputId}-remove-${index}`" @click="remove(index)">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
          </span>
          <span v-if="errors[`${key}.${index}`]" class="error" role="alert" :data-testid="`field-error-${key}.${index}`">{{ errors[`${key}.${index}`] }}</span>
        </div>
        <button type="button" class="prv add" :disabled="disabled || !canAdd" :data-testid="`${inputId}-add`" @click="addString">{{ t('common.add') }}</button>
      </div>
    </template>

    <template v-else-if="field.kind === 'object-list'">
      <span :id="`${inputId}-label`" class="label">{{ field.label }}</span>
      <div class="list" role="group" :aria-labelledby="`${inputId}-label`">
        <fieldset v-for="(item, index) in items" :key="index" class="card" :class="{ 'card-marked': mark && markValue(item) === mark.value }">
          <legend class="legend">{{ itemTitle(item, index) }}</legend>
          <div class="card-head">
            <button type="button" class="card-toggle" :aria-expanded="!collapsed.has(index)" :aria-label="t('properties.schema.toggleItem', { label: field.label, index: index + 1 })" :data-testid="`${inputId}-toggle-${index}`" @click="toggle(index)">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" :class="{ folded: collapsed.has(index) }"><path d="m6 9 6 6 6-6" /></svg>
              <span class="card-title">{{ itemTitle(item, index) }}</span>
            </button>
            <label v-if="mark" class="card-mark">
              <input type="radio" :name="`${inputId}-mark`" :checked="markValue(item) === mark.value" :disabled="disabled" :aria-label="t('properties.schema.markCorrectLabel', { label: mark.label, item: itemTitle(item, index) })" :data-testid="`${inputId}-mark-${index}`" @change="setMark(item)" />
              {{ t('properties.schema.markCorrect') }}
            </label>
            <span class="item-actions">
              <button type="button" class="ib" :aria-label="t('properties.schema.moveUp', { label: field.label, index: index + 1 })" :disabled="disabled || index === 0" :data-testid="`${inputId}-up-${index}`" @click="move(index, -1)">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6" /></svg>
              </button>
              <button type="button" class="ib" :aria-label="t('properties.schema.moveDown', { label: field.label, index: index + 1 })" :disabled="disabled || index === items.length - 1" :data-testid="`${inputId}-down-${index}`" @click="move(index, 1)">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </button>
            </span>
          </div>
          <template v-if="!collapsed.has(index)">
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
              :slides="slides"
              :mark="null"
              @change="(childPath, next) => emit('change', childPath, next)"
            />
            <button type="button" class="remove" :disabled="disabled || !canRemove" :data-testid="`${inputId}-remove-${index}`" @click="remove(index)">{{ t('common.remove') }}</button>
          </template>
        </fieldset>
        <button type="button" class="prv add" :disabled="disabled || !canAdd" :data-testid="`${inputId}-add`" @click="addObject">{{ t('common.add') }}</button>
      </div>
    </template>

    <template v-else-if="field.kind === 'media'">
      <span class="label">{{ field.label }}</span>
      <MediaPicker :id="key" :media="pickerMedia" :media-id="typeof value === 'string' ? value : null" :can-upload="canUpload" :accept="field.kind === 'media' ? field.accept : 'image/*'" :disabled="disabled" @pick="pickMedia" />
    </template>

    <span v-if="field.help" class="help" :data-testid="`${inputId}-help`">{{ field.help }}</span>
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
.item-actions { display: flex; align-items: center; gap: 2px; }
.item-actions .ib:disabled { opacity: 0.35; cursor: not-allowed; }
.card-head { display: flex; align-items: center; gap: 6px; min-width: 0; }
.card-toggle { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; padding: 0; background: transparent; border: 0; color: var(--s-text); font: inherit; font-size: 12px; text-align: left; cursor: pointer; }
.card-toggle svg { flex: none; transition: transform 0.15s ease; }
.card-toggle svg.folded { transform: rotate(-90deg); }
.card-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-mark { flex: none; display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--s-text-2); cursor: pointer; }
.card-marked { border-color: var(--s-active); }
.help { font-size: 11px; line-height: 1.4; color: var(--s-text-2); }
.item .error { grid-column: 1 / -1; }
.card { margin: 0; padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 8px; border: 1px solid var(--s-border); border-radius: 8px; background: var(--s-editor); min-width: 0; }
.legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
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
