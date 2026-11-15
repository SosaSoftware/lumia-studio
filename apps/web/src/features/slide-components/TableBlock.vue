<script setup lang="ts">
import { computed } from 'vue';
import { list, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { fillVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const columns = computed(() => list(props.data.columns).map((cell) => str(cell)));
const header = computed(() => props.data.headerRow !== false);
const rows = computed(() => {
  const body = list(props.data.rows).map((row) => columns.value.map((_, index) => str(list(row)[index])));
  return header.value ? body : [columns.value, ...body];
});
</script>

<template>
  <div
    class="el-table"
    :data-size="str(data.size, 'md')"
    :data-align="str(data.align, 'left')"
    :data-striped="data.striped !== false"
    :data-first-bold="data.firstColumnBold !== false"
    :style="fillVars(data.color, data.variant ?? 'solid', 'primary')"
  >
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
.el-table { overflow: hidden; background: var(--sl-card); border: 0.12cqw solid var(--sl-line); border-radius: 1.4cqw; box-shadow: var(--sl-elev-1); font-size: 1.6cqw; }
.el-table[data-size='sm'] { font-size: 1.3cqw; }
.el-table[data-size='lg'] { font-size: 1.9cqw; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th, td { padding: 0.7em 1em; line-height: 1.3; text-align: left; color: var(--sl-ink); overflow-wrap: anywhere; }
[data-align='center'] th, [data-align='center'] td { text-align: center; }
th { background: var(--fill); color: var(--fill-fg); font-weight: 600; letter-spacing: 0.01em; }
thead tr { background: var(--fill); }
tbody tr { background: var(--sl-card); }
[data-striped='true'] tbody tr[data-alt='true'] { background: color-mix(in srgb, var(--c-soft) 45%, var(--sl-card)); }
tbody tr + tr td { border-top: 0.12cqw solid var(--sl-line); }
td + td, th + th { border-left: 0.12cqw solid color-mix(in srgb, var(--sl-line) 60%, transparent); }
[data-first-bold='true'] td:first-child { font-weight: 600; color: var(--c-ink); }
</style>
