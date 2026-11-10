<script setup lang="ts">
import { computed } from 'vue';
import { ACTIONS } from '../../composables/app-context.ts';
import { canChange, changeDenial } from '../../composables/edit-lock.ts';
import { panels } from '../../composables/panels.ts';
import type { PaletteGroup } from '../../composables/panels.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import { COMPONENT_MIME, PALETTE_GROUP_NAMES, PALETTE_HINTS, componentsOf } from './palette.ts';
import StudioIcon from '../../ui/StudioIcon.vue';

const props = defineProps<{ group: PaletteGroup }>();

const workspace = useWorkspace();
const canEdit = computed(() => canChange(ACTIONS.edit));
const denied = computed(() => changeDenial('No tienes permiso para editar'));
const name = computed(() => PALETTE_GROUP_NAMES[props.group]);
const components = computed(() => (props.group === 'slides' ? [] : componentsOf(props.group, workspace.catalog.info.value.components)));

function addSlide(): void {
  if (canEdit.value) void workspace.session.addSlide();
}

function addComponent(key: string): void {
  if (canEdit.value) void workspace.session.addElement(key);
}

function dragStart(event: DragEvent, key: string): void {
  if (event.dataTransfer === null || !canEdit.value) {
    event.preventDefault();
    return;
  }
  event.dataTransfer.setData(COMPONENT_MIME, key);
  event.dataTransfer.effectAllowed = 'copy';
}
</script>

<template>
  <section class="panel" aria-labelledby="h-cat" data-testid="panel-components">
    <div class="s-panel-head">
      <h2 id="h-cat" class="lbl">{{ name }}</h2>
      <button type="button" class="ib" :aria-label="`Ocultar ${name}`" title="Ocultar" @click="panels.left = null"><StudioIcon name="minus" :size="15" /></button>
    </div>
    <div class="body" :data-testid="`palette-group-${group}`">
      <p class="hint">{{ PALETTE_HINTS[group] }}</p>
      <p v-if="!canEdit" class="hint denied" role="note">{{ changeDenial('No tienes permiso para editar esta clase.') }}</p>
      <div v-if="group === 'slides'" class="grid">
        <button
          type="button"
          class="ct"
          :aria-disabled="!canEdit"
          :title="canEdit ? 'Agregar una diapositiva en blanco al final' : denied"
          data-testid="palette-item-slide-blank"
          @click="addSlide"
        >
          <span class="ico"><StudioIcon name="plus" :size="22" :stroke="1.6" /></span>
          <span>En blanco</span>
        </button>
      </div>
      <div v-else class="grid">
        <button
          v-for="component in components"
          :key="component.key"
          type="button"
          class="ct"
          :aria-disabled="!canEdit"
          :draggable="canEdit"
          :title="canEdit ? 'Arrastra a la diapositiva' : denied"
          :aria-description="component.usage"
          :data-testid="`palette-item-${component.key}`"
          @click="addComponent(component.key)"
          @dragstart="dragStart($event, component.key)"
        >
          <span class="ico"><StudioIcon :name="`cmp-${component.key}`" :size="22" :stroke="1.6" /></span>
          <span>{{ component.name }}</span>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel { flex: none; width: 320px; min-height: 0; display: flex; flex-direction: column; background: var(--s-panel); border-right: 1px solid var(--s-border); }
.body { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 4px 12px 12px; }
.hint { margin: 0 2px 12px; font-size: 12px; line-height: 1.45; color: var(--s-text-2); }
.hint.denied { color: var(--s-warn); }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.ico { display: flex; color: var(--s-ico-class); }
.ct[aria-disabled='true'] { opacity: 0.5; cursor: not-allowed; }
</style>
