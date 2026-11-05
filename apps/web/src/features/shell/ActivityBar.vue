<script setup lang="ts">
import { computed } from 'vue';
import { PALETTE_GROUPS, panels, toggleLeft } from '../../composables/panels.ts';
import type { PaletteGroup } from '../../composables/panels.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import { PALETTE_GROUP_NAMES } from '../palette/palette.ts';
import StudioIcon from '../../ui/StudioIcon.vue';

const workspace = useWorkspace();
const hasClass = computed(() => workspace.activeClass.value !== null);

function tip(group: PaletteGroup): string {
  return hasClass.value ? PALETTE_GROUP_NAMES[group] : `${PALETTE_GROUP_NAMES[group]} · Abre una clase para usarlo`;
}

function pickGroup(group: PaletteGroup): void {
  if (hasClass.value) toggleLeft(group);
}

function isOpen(group: PaletteGroup): boolean {
  return hasClass.value && panels.left === group;
}
</script>

<template>
  <nav class="activity" aria-label="Herramientas">
    <div class="column">
      <button
        type="button"
        class="ab"
        aria-label="Explorador"
        :aria-pressed="panels.left === 'explorer'"
        :style="{ color: panels.left === 'explorer' ? 'var(--s-text)' : undefined }"
        data-testid="activity-explorer"
        @click="toggleLeft('explorer')"
      >
        <span v-if="panels.left === 'explorer'" class="ind l" aria-hidden="true"></span>
        <StudioIcon name="explorer" :size="20" :stroke="1.6" />
        <span class="tip l" aria-hidden="true">Explorador</span>
      </button>
      <div role="separator" class="separator"></div>
      <div role="group" aria-label="Grupos de componentes" class="column" data-testid="activity-components">
        <button
          v-for="group in PALETTE_GROUPS"
          :key="group"
          type="button"
          class="ab"
          :aria-label="PALETTE_GROUP_NAMES[group]"
          :aria-pressed="isOpen(group)"
          :aria-disabled="!hasClass"
          :aria-describedby="`tip-group-${group}`"
          :style="{ color: isOpen(group) ? 'var(--s-text)' : undefined }"
          :data-testid="`activity-group-${group}`"
          @click="pickGroup(group)"
        >
          <span v-if="isOpen(group)" class="ind l" aria-hidden="true"></span>
          <StudioIcon :name="`group-${group}`" :size="20" :stroke="1.6" />
          <span :id="`tip-group-${group}`" class="tip l" role="tooltip">{{ tip(group) }}</span>
        </button>
      </div>
    </div>
    <div class="column bottom">
      <button type="button" class="ab" aria-label="Configuración" aria-disabled="true" aria-describedby="tip-settings" data-testid="activity-settings">
        <StudioIcon name="settings" :size="20" :stroke="1.6" />
        <span id="tip-settings" class="tip l" role="tooltip">Configuración · Próximamente</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.activity { flex: none; width: 48px; box-sizing: border-box; padding: 4px 0; display: flex; flex-direction: column; align-items: center; justify-content: space-between; background: var(--s-chrome); border-right: 1px solid var(--s-border); position: relative; z-index: 20; }
.column { display: flex; flex-direction: column; align-items: center; }
.bottom { padding-bottom: 4px; }
.separator { width: 22px; height: 1px; margin: 6px 0; background: var(--s-border); }
</style>
