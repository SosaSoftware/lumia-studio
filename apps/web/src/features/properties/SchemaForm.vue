<script setup lang="ts">
import { computed } from 'vue';
import { list, rec, str } from '../../api/decode.ts';
import type { MediaAsset, MediaRef, Slide, SlideElement } from '../../api/types.ts';
import SchemaField from './SchemaField.vue';
import TableEditor from './TableEditor.vue';
import { inlineReferences } from './property-layout.ts';
import { describeSchema, setAtPath } from './schema-form-model.ts';
import type { FieldDescriptor, FieldPath } from './schema-form-model.ts';

const props = withDefaults(
  defineProps<{
    /** JSON Schema of the component props, from the catalog. */
    schema: Record<string, unknown>;
    modelValue: Record<string, unknown>;
    /** Fields to draw, in order; every field of the schema when absent. */
    fields?: readonly FieldDescriptor[] | null;
    /** Catalog key of the component, for labels and reference pickers. */
    component?: string;
    /** API validation messages by field path relative to the props (`text`, `options.0.text`). */
    errors?: Readonly<Record<string, string>>;
    disabled?: boolean;
    canUpload?: boolean;
    media?: MediaRef | null;
    /** Elements of the slide, for the connector. */
    elements?: readonly SlideElement[];
    elementId?: string;
    /** Slides of the class, for fields that point to one of them. */
    slides?: readonly Slide[];
  }>(),
  { slides: () => [], fields: null, component: '', errors: () => ({}), disabled: false, canUpload: false, media: null, elements: () => [], elementId: '' },
);

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>];
  media: [asset: MediaAsset | null];
}>();

const allFields = computed(() => describeSchema(props.schema));
const inline = computed(() => inlineReferences(allFields.value));
const shown = computed(() => {
  if (props.fields !== null) return props.fields;
  const hidden = new Set(inline.value.map((field) => field.key));
  let tableShown = false;
  return allFields.value.filter((field) => {
    if (field.auto || hidden.has(field.key)) return false;
    if (field.control !== 'table') return true;
    if (tableShown) return false;
    tableShown = true;
    return true;
  });
});

/** Mark of the correct item drawn inside a list, from the top-level field that refers to that list. */
function markOf(field: FieldDescriptor): { key: string; label: string; valueKey: string; value: string } | null {
  const owner = inline.value.find((candidate) => candidate.ref?.kind === 'list' && candidate.ref.list === field.key);
  if (owner?.ref?.kind !== 'list') return null;
  return { key: owner.key, label: owner.label, valueKey: owner.ref.value, value: str(props.modelValue[owner.key]) };
}

/** A removed item may be the one an inline reference pointed to: the reference moves to the first item left. */
function keepReferences(value: Record<string, unknown>): Record<string, unknown> {
  let next = value;
  for (const owner of inline.value) {
    if (owner.ref?.kind !== 'list') continue;
    const valueKey = owner.ref.value;
    const ids = list(next[owner.ref.list]).map((item) => str(rec(item)[valueKey]));
    const first = ids[0];
    if (first !== undefined && !ids.includes(str(next[owner.key]))) next = { ...next, [owner.key]: first };
  }
  return next;
}

function onChange(path: FieldPath, value: unknown): void {
  const next = setAtPath(props.modelValue, path, value);
  if (typeof next === 'object' && next !== null && !Array.isArray(next)) emit('update:modelValue', keepReferences({ ...next }));
}

function onTable(columns: string[], rows: string[][]): void {
  emit('update:modelValue', { ...props.modelValue, columns, rows });
}

/** Choosing a medium sets `mediaId` and tells the parent about the asset so the canvas shows it at once. */
function onMedia(key: string, asset: MediaAsset | null): void {
  onChange([key], asset?.id ?? null);
  emit('media', asset);
}
</script>

<template>
  <form class="schema-form" data-testid="schema-form" @submit.prevent>
    <template v-for="field in shown" :key="field.key">
      <TableEditor v-if="field.control === 'table'" :columns="modelValue.columns" :rows="modelValue.rows" :disabled="disabled" :errors="errors" @change="onTable" />
      <SchemaField
        v-else
        :field="field"
        :path="[field.key]"
        :value="modelValue[field.key]"
        :root="modelValue"
        :component="component"
        :errors="errors"
        :disabled="disabled"
        :can-upload="canUpload"
        :media="media"
        :elements="elements"
        :element-id="elementId"
        :slides="slides"
        :mark="markOf(field)"
        @change="onChange"
        @media="onMedia(field.key, $event)"
      />
    </template>
  </form>
</template>

<style scoped>
.schema-form { display: flex; flex-direction: column; gap: 12px; }
</style>
