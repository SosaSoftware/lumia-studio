<script setup lang="ts">
import { computed } from 'vue';
import { panels } from '../../composables/panels.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import { t } from '../../i18n/index.ts';
import { componentName } from '../editor/catalog-labels.ts';
import { tagGroup } from '../palette/palette.ts';
import StudioIcon from '../../ui/StudioIcon.vue';
import AudioProperties from './AudioProperties.vue';
import ElementProperties from './ElementProperties.vue';
import NodeProperties from './NodeProperties.vue';
import NarrationProperties from './NarrationProperties.vue';
import PauseProperties from './PauseProperties.vue';
import SlideProperties from './SlideProperties.vue';

const workspace = useWorkspace();
const session = workspace.session;

const inspected = computed(() => workspace.inspectedNode.value);
const slide = computed(() => session.currentSlide);
const total = computed(() => session.state.slides.length);
const position = computed(() => session.state.slides.findIndex((candidate) => candidate.id === slide.value?.id) + 1);
const element = computed(() => session.selectedElement);
const narration = computed(() => session.selectedNarration);
const audio = computed(() => session.selectedAudio);
const pause = computed(() => session.selectedPause);
const className = computed(() => workspace.activeClass.value?.displayName ?? '');

/** What the breadcrumb shows after "Diapositiva N", as in the design. */
const selectionLabel = computed(() => {
  const current = slide.value;
  if (current === null) return '';
  if (element.value !== null) {
    const info = workspace.catalog.component(element.value.component);
    return info === undefined ? element.value.name : `${tagGroup(info.group)} · ${componentName(info)}`;
  }
  if (narration.value !== null) {
    const index = current.narrationClips.findIndex((clip) => clip.id === narration.value?.id);
    return t('properties.panel.narrationCrumb', { index: index + 1, total: current.narrationClips.length });
  }
  if (audio.value !== null) return t('properties.panel.audioCrumb', { name: audio.value.name });
  if (pause.value !== null) return t('properties.panel.pauseCrumb', { number: current.pauses.findIndex((item) => item.id === pause.value?.id) + 1 });
  if (session.state.selectedClip?.kind === 'transition') return t('properties.panel.transitionCrumb');
  return '';
});

function clear(): void {
  session.selectElement(null);
  session.selectClip(null);
}
</script>

<template>
  <aside class="panel" aria-labelledby="h-props" data-testid="panel-properties">
    <div class="s-panel-head">
      <h2 id="h-props" class="lbl">{{ t('properties.panel.title') }}</h2>
      <button type="button" class="ib" :aria-label="t('properties.panel.hide')" :title="t('common.hide')" @click="panels.right = null"><StudioIcon name="minus" :size="15" /></button>
    </div>

    <NodeProperties v-if="inspected" :key="inspected.id" :node="inspected" />
    <p v-else-if="!slide" class="empty" data-testid="properties-empty">{{ t('properties.panel.empty') }}</p>

    <template v-else>
      <div class="s-identity" :aria-label="t('properties.panel.editingSlide', { position, total, title: slide.title })" data-testid="properties-identity">
        <span class="s-identity-num" aria-hidden="true">{{ position }}</span>
        <span class="s-identity-meta">
          <span class="s-identity-where">{{ t('properties.panel.slideWhere', { className, position, total }) }}</span>
          <span class="s-identity-title">{{ slide.title }}</span>
        </span>
      </div>
      <div v-if="selectionLabel" class="crumb">
        <button type="button" class="lnk" data-testid="properties-back" @click="clear">{{ t('properties.panel.slideCrumb', { position }) }}</button>
        <span aria-hidden="true">›</span>
        <span class="current" data-testid="properties-selection">{{ selectionLabel }}</span>
      </div>

      <ElementProperties v-if="element" :key="element.id" :element="element" :slide="slide" />
      <NarrationProperties v-else-if="narration" :key="narration.id" :clip="narration" />
      <AudioProperties v-else-if="audio" :key="audio.id" :clip="audio" />
      <PauseProperties v-else-if="pause" :key="pause.id" :pause="pause" :slide="slide" />
      <SlideProperties v-else :key="slide.id" :slide="slide" />
    </template>
  </aside>
</template>

<style scoped>
.panel { flex: none; width: 340px; min-height: 0; display: flex; flex-direction: column; background: var(--s-panel); border-left: 1px solid var(--s-border); }
.empty { margin: 8px 14px; font-size: 13px; line-height: 1.5; color: var(--s-text-2); }
.crumb { flex: none; margin: 0 14px 10px; display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--s-text-2); min-width: 0; }
.crumb .current { color: var(--s-text); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
