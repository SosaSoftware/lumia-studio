<script setup lang="ts">
import { computed } from 'vue';
import type { MediaAsset, MediaRef, SlideElement } from '../../api/types.ts';
import SchemaField from './SchemaField.vue';
import TableEditor from './TableEditor.vue';
import { describeSchema, setAtPath } from './schema-form-model.ts';
import type { FieldPath } from './schema-form-model.ts';

const props = withDefaults(
  defineProps<{
    /** JSON Schema of the component props, from the catalog. */
    schema: Record<string, unknown>;
    modelValue: Record<string, unknown>;
    /** Catalog key of the component, for labels and reference pickers. */
    component?: string;
    /** API validation messages by field path relative to the props (`text`, `options.0.text`). */
    errors?: Readonly<Record<string, string>>;
    disabled?: boolean;
    canUpload?: boolean;
    media?: MediaRef | null;
    mediaAccept?: string;
    /** Elements of the slide, for the connector. */
    elements?: readonly SlideElement[];
    elementId?: string;
  }>(),
  { component: '', errors: () => ({}), disabled: false, canUpload: false, media: null, mediaAccept: 'image/*', elements: () => [], elementId: '' },
);

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>];
  media: [asset: MediaAsset | null];
}>();

const fields = computed(() => describeSchema(props.schema));
const isTable = computed(() => props.component === 'table');
const shown = computed(() => (isTable.value ? fields.value.filter((field) => field.key !== 'columns' && field.key !== 'rows') : fields.value));

function onChange(path: FieldPath, value: unknown): void {
  const next = setAtPath(props.modelValue, path, value);
  if (typeof next === 'object' && next !== null && !Array.isArray(next)) emit('update:modelValue', { ...next });
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
    <TableEditor v-if="isTable" :columns="modelValue.columns" :rows="modelValue.rows" :disabled="disabled" :errors="errors" @change="onTable" />
    <SchemaField
      v-for="field in shown"
      :key="field.key"
      :field="field"
      :path="[field.key]"
      :value="modelValue[field.key]"
      :root="modelValue"
      :component="component"
      :errors="errors"
      :disabled="disabled"
      :can-upload="canUpload"
      :media="media"
      :media-accept="mediaAccept"
      :elements="elements"
      :element-id="elementId"
      @change="onChange"
      @media="onMedia(field.key, $event)"
    />
  </form>
</template>

<style scoped>
.schema-form { display: flex; flex-direction: column; gap: 12px; }
</style>
