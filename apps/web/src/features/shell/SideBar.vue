<script setup lang="ts">
import { computed, ref } from 'vue';
import { useDismiss } from '../../composables/dismiss.ts';
import { panels, toggleBottom, toggleRight } from '../../composables/panels.ts';
import type { BottomPanel, RightPanel } from '../../composables/panels.ts';
import { theme, toggleTheme } from '../../composables/theme.ts';
import { LANGS, LANG_NAMES, lang, setLang, t } from '../../i18n/index.ts';
import type { Lang } from '../../i18n/index.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import LumiStar from '../../ui/LumiStar.vue';
import StudioIcon from '../../ui/StudioIcon.vue';

const workspace = useWorkspace();
/** Comments and the bottom panels need a class with at least one slide, as in the design. */
const canEdit = computed(() => workspace.activeClass.value !== null && workspace.session.state.slides.length > 0);
/** Properties also shows the folder or class selected in the tree. */
const canInspect = computed(() => canEdit.value || workspace.inspectedNode.value !== null);

function available(name: RightPanel): boolean {
  return name === 'lumi' || (name === 'properties' ? canInspect.value : canEdit.value);
}

const langOpen = ref(false);
const langMenu = ref<HTMLElement | null>(null);
useDismiss(langMenu, () => langOpen.value, () => {
  langOpen.value = false;
});

function rightOn(name: RightPanel): boolean {
  return panels.right === name && available(name);
}

function bottomOn(name: BottomPanel): boolean {
  return panels.bottom === name && canEdit.value;
}

function pickRight(name: RightPanel): void {
  if (available(name)) toggleRight(name);
}

function pickBottom(name: BottomPanel): void {
  if (canEdit.value) toggleBottom(name);
}

function tip(name: string): string {
  return canEdit.value ? name : t('common.needClass', { name });
}

function pickLang(next: Lang): void {
  setLang(next);
  langOpen.value = false;
}

const themeNext = computed(() => (theme.value === 'light' ? t('shell.sidebar.themeToNight') : t('shell.sidebar.themeToDay')));
</script>

<template>
  <nav class="sidebar" :aria-label="t('shell.sidebar.label')">
    <div class="column">
      <button type="button" class="ab" aria-label="Lumi" :aria-pressed="rightOn('lumi')" data-testid="activity-lumi" @click="pickRight('lumi')">
        <span v-if="rightOn('lumi')" class="ind r" aria-hidden="true"></span>
        <LumiStar :size="20" />
        <span class="tip r" aria-hidden="true">Lumi</span>
      </button>
      <button
        type="button"
        class="ab"
        :aria-label="t('shell.sidebar.properties')"
        :aria-pressed="rightOn('properties')"
        :aria-disabled="!canInspect"
        aria-describedby="tip-rpb-props"
        data-testid="activity-properties"
        @click="pickRight('properties')"
      >
        <span v-if="rightOn('properties')" class="ind r" aria-hidden="true"></span>
        <StudioIcon name="properties" :size="20" :stroke="1.6" />
        <span id="tip-rpb-props" class="tip r" role="tooltip">{{ canInspect ? t('shell.sidebar.properties') : t('shell.sidebar.propertiesDisabled') }}</span>
      </button>
      <button
        type="button"
        class="ab"
        :aria-label="t('shell.sidebar.comments')"
        :aria-pressed="rightOn('comments')"
        :aria-disabled="!canEdit"
        aria-describedby="tip-rpb-coms"
        data-testid="activity-comments"
        @click="pickRight('comments')"
      >
        <span v-if="rightOn('comments')" class="ind r" aria-hidden="true"></span>
        <StudioIcon name="comments" :size="20" :stroke="1.6" />
        <span id="tip-rpb-coms" class="tip r" role="tooltip">{{ tip(t('shell.sidebar.comments')) }}</span>
      </button>
    </div>
    <div class="column bottom">
      <div role="group" :aria-label="t('shell.sidebar.bottomPanel')" class="column">
        <button
          type="button"
          class="ab"
          :aria-label="t('shell.sidebar.slides')"
          :aria-pressed="bottomOn('slides')"
          :aria-disabled="!canEdit"
          aria-describedby="tip-bpb-slides"
          data-testid="activity-slides"
          @click="pickBottom('slides')"
        >
          <span v-if="bottomOn('slides')" class="ind r" aria-hidden="true"></span>
          <StudioIcon name="panel-slides" :size="20" :stroke="1.6" />
          <span id="tip-bpb-slides" class="tip r" role="tooltip">{{ tip(t('shell.sidebar.slides')) }}</span>
        </button>
        <button
          type="button"
          class="ab"
          :aria-label="t('shell.sidebar.timeline')"
          :aria-pressed="bottomOn('timeline')"
          :aria-disabled="!canEdit"
          aria-describedby="tip-bpb-tl"
          data-testid="activity-timeline"
          @click="pickBottom('timeline')"
        >
          <span v-if="bottomOn('timeline')" class="ind r" aria-hidden="true"></span>
          <StudioIcon name="panel-timeline" :size="20" :stroke="1.6" />
          <span id="tip-bpb-tl" class="tip r" role="tooltip">{{ tip(t('shell.sidebar.timeline')) }}</span>
        </button>
      </div>
      <div role="separator" class="separator"></div>
      <button type="button" class="ab" :aria-label="themeNext" data-testid="activity-theme" @click="toggleTheme">
        <StudioIcon :name="theme === 'light' ? 'sun' : 'moon'" :size="18" :stroke="1.6" />
        <span class="tip r" aria-hidden="true">{{ themeNext }}</span>
      </button>
      <div ref="langMenu" class="lang-anchor">
        <button
          type="button"
          class="ab"
          aria-haspopup="listbox"
          :aria-expanded="langOpen"
          :aria-label="t('shell.sidebar.languageCurrent', { name: LANG_NAMES[lang] })"
          data-testid="activity-lang"
          @click="langOpen = !langOpen"
        >
          <span class="lang-code" :style="{ background: langOpen ? 'var(--s-hover)' : 'transparent' }">{{ lang.toUpperCase() }}</span>
          <span class="tip r" aria-hidden="true">{{ t('shell.sidebar.languageCurrent', { name: LANG_NAMES[lang] }) }}</span>
        </button>
        <div v-if="langOpen" class="s-menu langs" role="listbox" :aria-label="t('shell.sidebar.language')">
          <button
            v-for="code in LANGS"
            :key="code"
            type="button"
            class="mi lang-option"
            role="option"
            :aria-selected="code === lang"
            :style="{ background: code === lang ? 'var(--s-hover)' : undefined }"
            :data-testid="`lang-${code}`"
            @click="pickLang(code)"
          >
            <span :lang="code">{{ LANG_NAMES[code] }}</span>
            <span v-if="code === lang" class="s-check"><StudioIcon name="check" :size="14" :stroke="2.2" /></span>
          </button>
        </div>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.sidebar { flex: none; width: 48px; box-sizing: border-box; padding: 4px 0; display: flex; flex-direction: column; align-items: center; justify-content: space-between; background: var(--s-chrome); border-left: 1px solid var(--s-border); position: relative; z-index: 20; }
.column { display: flex; flex-direction: column; align-items: center; }
.bottom { padding-bottom: 4px; }
.separator { width: 22px; height: 1px; margin: 6px 0; background: var(--s-border); }
.lang-anchor { position: relative; }
.lang-code { width: 28px; height: 22px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border: 1px solid var(--s-border); border-radius: 5px; }
.langs { right: calc(100% + 4px); bottom: 0; width: 160px; }
.lang-option { justify-content: space-between; }
</style>
