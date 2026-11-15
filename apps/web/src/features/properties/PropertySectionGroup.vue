<script setup lang="ts">
import { computed, ref } from 'vue';
import { propertySections } from '../../composables/property-sections.ts';
import { t } from '../../i18n/index.ts';
import type { PanelBlock, PanelSection } from './property-layout.ts';

const props = defineProps<{ section: PanelSection }>();

defineSlots<{ default(slotProps: { blocks: PanelBlock[] }): unknown }>();

/** Whether the advanced fields show; not remembered, so the panel opens with the essential fields only. */
const advancedShown = ref(false);

const open = computed(() => propertySections.open[props.section.key] ?? props.section.startsOpen);
const blocks = computed(() => (advancedShown.value ? [...props.section.basic, ...props.section.advanced] : props.section.basic));

function toggle(): void {
  propertySections.open[props.section.key] = !open.value;
}
</script>

<template>
  <section class="prop-sec prop-group" :data-testid="`prop-section-${section.key}`">
    <h3 class="sec-head">
      <button type="button" class="sec sec-toggle" :aria-expanded="open" :data-testid="`prop-section-toggle-${section.key}`" @click="toggle">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" :class="{ folded: !open }"><path d="m6 9 6 6 6-6" /></svg>
        {{ section.label }}
      </button>
    </h3>
    <div v-if="open" class="sec-body">
      <slot :blocks="blocks"></slot>
      <button v-if="section.advanced.length > 0" type="button" class="lnk more" :aria-expanded="advancedShown" :data-testid="`prop-section-more-${section.key}`" @click="advancedShown = !advancedShown">
        {{ advancedShown ? t('properties.element.fewerOptions') : t('properties.element.moreOptions') }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.prop-group { flex: none; gap: 0; border-top: 1px solid var(--s-border); padding-top: 4px; }
.sec-head { margin: 0; }
.sec-toggle { justify-content: flex-start; gap: 6px; padding: 0 2px; color: var(--s-text-2); text-align: left; }
.sec-toggle svg { flex: none; transition: transform 0.15s ease; }
.sec-toggle svg.folded { transform: rotate(-90deg); }
.sec-body { display: flex; flex-direction: column; gap: 12px; padding: 4px 0 10px; }
.more { align-self: flex-start; font-size: 12px; }
</style>
