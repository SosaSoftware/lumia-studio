<script setup lang="ts">
import { computed } from 'vue';
import { list, str } from '../../api/decode.ts';
import { inputValue } from './controls.ts';

const props = defineProps<{ columns: unknown; rows: unknown; disabled: boolean; errors: Readonly<Record<string, string>> }>();
const emit = defineEmits<{ change: [columns: string[], rows: string[][]] }>();

const MAX_COLUMNS = 6;
const MAX_ROWS = 10;

const headers = computed(() => list(props.columns).map((cell) => str(cell)));
const body = computed(() => list(props.rows).map((row) => headers.value.map((_, index) => str(list(row)[index]))));

function setHeader(index: number, value: string): void {
  emit('change', headers.value.map((cell, position) => (position === index ? value : cell)), body.value);
}

function setCell(rowIndex: number, cellIndex: number, value: string): void {
  emit('change', headers.value, body.value.map((row, position) => (position === rowIndex ? row.map((cell, column) => (column === cellIndex ? value : cell)) : row)));
}

function addColumn(): void {
  if (headers.value.length >= MAX_COLUMNS) return;
  emit('change', [...headers.value, `Columna ${String(headers.value.length + 1)}`], body.value.map((row) => [...row, '']));
}

function removeColumn(index: number): void {
  if (headers.value.length <= 1) return;
  emit('change', headers.value.filter((_, position) => position !== index), body.value.map((row) => row.filter((_, position) => position !== index)));
}

function addRow(): void {
  if (body.value.length >= MAX_ROWS) return;
  emit('change', headers.value, [...body.value, headers.value.map(() => '')]);
}

function removeRow(index: number): void {
  if (body.value.length <= 1) return;
  emit('change', headers.value, body.value.filter((_, position) => position !== index));
}
</script>

<template>
  <div class="table-editor" data-testid="table-editor">
    <span class="label">Celdas</span>
    <div class="scroll">
      <div class="grid" :style="{ gridTemplateColumns: `repeat(${headers.length}, minmax(72px, 1fr)) 22px` }">
        <template v-for="(cell, index) in headers" :key="`h${index}`">
          <span class="cell head">
            <input class="pv control" :value="cell" :aria-label="`Columna ${index + 1}`" :disabled="disabled" :data-testid="`field-columns-${index}`" @input="setHeader(index, inputValue($event))" />
            <button type="button" class="ib remove" :aria-label="`Quitar la columna ${index + 1}`" title="Quitar columna" :disabled="disabled || headers.length <= 1" :data-testid="`field-columns-remove-${index}`" @click="removeColumn(index)">×</button>
          </span>
        </template>
        <span></span>
        <template v-for="(row, rowIndex) in body" :key="`r${rowIndex}`">
          <input
            v-for="(cell, cellIndex) in row"
            :key="`c${rowIndex}-${cellIndex}`"
            class="pv control"
            :value="cell"
            :aria-label="`Fila ${rowIndex + 1}, columna ${cellIndex + 1}`"
            :disabled="disabled"
            :data-testid="`field-rows-${rowIndex}-${cellIndex}`"
            @input="setCell(rowIndex, cellIndex, inputValue($event))"
          />
          <button type="button" class="ib" :aria-label="`Quitar la fila ${rowIndex + 1}`" title="Quitar fila" :disabled="disabled || body.length <= 1" :data-testid="`field-rows-remove-${rowIndex}`" @click="removeRow(rowIndex)">×</button>
        </template>
      </div>
    </div>
    <div class="actions">
      <button type="button" class="prv" :disabled="disabled || headers.length >= MAX_COLUMNS" data-testid="field-columns-add" @click="addColumn">Agregar columna</button>
      <button type="button" class="prv" :disabled="disabled || body.length >= MAX_ROWS" data-testid="field-rows-add" @click="addRow">Agregar fila</button>
    </div>
    <span v-if="errors.columns || errors.rows" class="error" role="alert" data-testid="field-error-rows">{{ errors.columns ?? errors.rows }}</span>
  </div>
</template>

<style scoped>
.table-editor { display: flex; flex-direction: column; gap: 6px; }
.label { font-size: 12px; color: var(--s-text-2); }
.scroll { overflow-x: auto; }
.grid { display: grid; gap: 4px; align-items: center; }
.cell.head { position: relative; display: flex; }
.cell.head .control { font-weight: 600; padding-right: 20px; }
.remove { position: absolute; right: 1px; top: 2px; width: 18px; height: 26px; }
.control { width: 100%; min-width: 0; color: var(--s-text); font: inherit; font-size: 12px; }
.control:focus { outline: none; border-color: var(--s-active); }
.actions { display: flex; gap: 6px; }
.actions .prv:disabled { opacity: 0.45; cursor: not-allowed; }
.error { font-size: 12px; color: var(--s-danger); }
</style>
