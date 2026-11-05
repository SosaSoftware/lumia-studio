<script setup lang="ts">
import { computed } from 'vue';
import { list, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';

const props = defineProps<CatalogComponentProps>();
const columns = computed(() => list(props.data.columns).map((cell) => str(cell)));
const header = computed(() => props.data.headerRow !== false);
const rows = computed(() => {
  const body = list(props.data.rows).map((row) => columns.value.map((_, index) => str(list(row)[index])));
  return header.value ? body : [columns.value, ...body];
});
</script>

<template>
  <div class="el-table">
    <table>
      <thead v-if="header">
        <tr><th v-for="(cell, index) in columns" :key="index" scope="col">{{ cell }}</th></tr>
      </thead>
      <tbody>
        <tr v-for="(row, rowIndex) in rows" :key="rowIndex" :data-alt="rowIndex % 2 === 1">
          <td v-for="(cell, cellIndex) in row" :key="cellIndex">{{ cell }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.el-table { overflow: hidden; background: var(--sl-card); border: 0.12cqw solid var(--sl-line); border-radius: 1.2cqw; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th, td { padding: 1.1cqw 1.6cqw; font-size: 1.6cqw; line-height: 1.3; text-align: left; color: var(--sl-ink); overflow-wrap: anywhere; }
th { background: var(--sl-blue); color: var(--sl-white); font-weight: 600; }
tbody tr { background: var(--sl-card); }
tbody tr[data-alt='true'] { background: var(--sl-card-alt); }
tbody tr + tr td { border-top: 0.12cqw solid var(--sl-line); }
td:first-child { font-weight: 600; }
</style>
