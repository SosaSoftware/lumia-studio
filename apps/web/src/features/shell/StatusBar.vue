<script setup lang="ts">
import { computed } from 'vue';
import { useWorkspace } from '../../composables/workspace.ts';
import LumiStar from '../../ui/LumiStar.vue';
import StudioIcon from '../../ui/StudioIcon.vue';

const workspace = useWorkspace();
const session = workspace.session;

/** Category › subcategory › folders › class open, or the path to the node selected in the tree. */
const crumbs = computed(() => {
  const category = workspace.category.value;
  const subcategory = workspace.subcategory.value;
  if (category === null || subcategory === null) return [];
  const head = [category.displayName, subcategory.displayName];
  const node = workspace.activeClass.value;
  if (node !== null) return [...head, ...workspace.pathOf(node.id).map((item) => item.displayName)];
  return [...head, ...workspace.selectedPath.value];
});

const position = computed(() => {
  const slides = session.state.slides;
  const index = slides.findIndex((slide) => slide.id === session.state.selectedSlideId);
  return workspace.activeClass.value !== null && slides.length > 0 && index >= 0 ? `Diapositiva ${String(index + 1)} de ${String(slides.length)}` : '';
});
const saving = computed(() => session.state.pending > 0);
</script>

<template>
  <footer class="statusbar" data-testid="statusbar">
    <span class="brand"><LumiStar :size="12" color="var(--s-on-active)" dots="var(--s-lumi-dots-on)" /> Lumia Studio</span>
    <nav aria-label="Ruta" class="crumbs" data-testid="status-route">
      <template v-for="(crumb, index) in crumbs" :key="index">
        <span v-if="index > 0" class="sep" aria-hidden="true"><StudioIcon name="chevron-right" :size="10" :stroke="2" /></span>
        <span class="crumb" :class="{ current: index === crumbs.length - 1 }" :aria-current="index === crumbs.length - 1 ? 'page' : undefined">
          <StudioIcon v-if="index === 0" name="building" :size="12" />
          <StudioIcon v-else-if="index === 1" name="book" :size="12" />
          {{ crumb }}
        </span>
      </template>
    </nav>
    <span class="end">
      <span class="saving" role="status" data-testid="status-saving" :data-pending="saving ? 'true' : 'false'">{{ saving ? 'Guardando…' : '' }}</span>
      <span v-if="position" data-testid="status-position">{{ position }}</span>
    </span>
  </footer>
</template>

<style scoped>
.statusbar { flex: none; height: 24px; box-sizing: border-box; display: flex; align-items: center; background: var(--s-chrome); border-top: 1px solid var(--s-border); font-size: 12px; color: var(--s-text-2); white-space: nowrap; overflow: hidden; }
.brand { height: 100%; display: flex; align-items: center; gap: 6px; padding: 0 10px; background: var(--s-active); color: var(--s-on-active); }
.crumbs { display: flex; align-items: center; gap: 6px; min-width: 0; padding: 0 10px; overflow: hidden; }
.sep { display: flex; opacity: 0.7; }
.crumb { display: flex; align-items: center; gap: 5px; color: var(--s-text-2); }
.crumb.current { color: var(--s-text); }
.end { margin-left: auto; display: flex; align-items: center; gap: 14px; padding: 0 12px; }
.saving:empty { display: none; }
</style>
