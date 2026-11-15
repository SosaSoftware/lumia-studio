<script setup lang="ts">
import { computed, ref } from 'vue';
import { useDismiss } from '../../composables/dismiss.ts';
import { PALETTE_GROUPS, panels, toggleLeft } from '../../composables/panels.ts';
import type { PaletteGroup } from '../../composables/panels.ts';
import { setTheme, theme } from '../../composables/theme.ts';
import type { ThemeName } from '../../composables/theme.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import { LANGS, LANG_NAMES, lang, setLang, t } from '../../i18n/index.ts';
import type { Lang } from '../../i18n/index.ts';
import { paletteGroupName } from '../palette/palette.ts';
import StudioIcon from '../../ui/StudioIcon.vue';

const workspace = useWorkspace();
const hasClass = computed(() => workspace.activeClass.value !== null);

function tip(group: PaletteGroup): string {
  return hasClass.value ? paletteGroupName(group) : t('common.needClass', { name: paletteGroupName(group) });
}

function pickGroup(group: PaletteGroup): void {
  if (hasClass.value) toggleLeft(group);
}

function isOpen(group: PaletteGroup): boolean {
  return hasClass.value && panels.left === group;
}

/** Floating menu of the settings button: the preferences of the person, not of the class. */
const settingsOpen = ref(false);
const settingsAnchor = ref<HTMLElement | null>(null);
useDismiss(settingsAnchor, () => settingsOpen.value, () => {
  settingsOpen.value = false;
});

const THEMES: readonly { name: ThemeName; icon: string; label: () => string }[] = [
  { name: 'light', icon: 'sun', label: () => t('shell.activity.themeDay') },
  { name: 'dark', icon: 'moon', label: () => t('shell.activity.themeNight') },
];

function pickTheme(next: ThemeName): void {
  setTheme(next);
  settingsOpen.value = false;
}

function pickLang(next: Lang): void {
  setLang(next);
  settingsOpen.value = false;
}
</script>

<template>
  <nav class="activity" :aria-label="t('shell.activity.label')">
    <div class="column">
      <button
        type="button"
        class="ab"
        :aria-label="t('shell.activity.explorer')"
        :aria-pressed="panels.left === 'explorer'"
        :style="{ color: panels.left === 'explorer' ? 'var(--s-text)' : undefined }"
        data-testid="activity-explorer"
        @click="toggleLeft('explorer')"
      >
        <span v-if="panels.left === 'explorer'" class="ind l" aria-hidden="true"></span>
        <StudioIcon name="explorer" :size="20" :stroke="1.6" />
        <span class="tip l" aria-hidden="true">{{ t('shell.activity.explorer') }}</span>
      </button>
      <div role="separator" class="separator"></div>
      <div role="group" :aria-label="t('shell.activity.groups')" class="column" data-testid="activity-components">
        <button
          v-for="group in PALETTE_GROUPS"
          :key="group"
          type="button"
          class="ab"
          :aria-label="paletteGroupName(group)"
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
      <div ref="settingsAnchor" class="settings-anchor">
        <button
          type="button"
          class="ab"
          aria-haspopup="menu"
          :aria-expanded="settingsOpen"
          :aria-label="t('shell.activity.settings')"
          aria-describedby="tip-settings"
          data-testid="activity-settings"
          @click="settingsOpen = !settingsOpen"
        >
          <StudioIcon name="settings" :size="20" :stroke="1.6" />
          <span v-if="!settingsOpen" id="tip-settings" class="tip l" role="tooltip">{{ t('shell.activity.settings') }}</span>
        </button>
        <div v-if="settingsOpen" class="s-menu settings" role="menu" :aria-label="t('shell.activity.settings')" data-testid="settings-menu">
          <div class="menu-group" role="presentation">{{ t('shell.activity.theme') }}</div>
          <button
            v-for="option in THEMES"
            :key="option.name"
            type="button"
            class="mi"
            role="menuitemradio"
            :aria-checked="theme === option.name"
            :data-testid="`theme-${option.name}`"
            @click="pickTheme(option.name)"
          >
            <StudioIcon :name="option.icon" :size="16" :stroke="1.6" />
            <span class="grow">{{ option.label() }}</span>
            <span v-if="theme === option.name" class="s-check"><StudioIcon name="check" :size="14" :stroke="2.2" /></span>
          </button>
          <div class="rule" role="separator"></div>
          <div class="menu-group" role="presentation">{{ t('shell.activity.language') }}</div>
          <button
            v-for="code in LANGS"
            :key="code"
            type="button"
            class="mi"
            role="menuitemradio"
            :aria-checked="code === lang"
            :data-testid="`lang-${code}`"
            @click="pickLang(code)"
          >
            <span class="code" aria-hidden="true">{{ code.toUpperCase() }}</span>
            <span class="grow" :lang="code">{{ LANG_NAMES[code] }}</span>
            <span v-if="code === lang" class="s-check"><StudioIcon name="check" :size="14" :stroke="2.2" /></span>
          </button>
        </div>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.activity { flex: none; width: 48px; box-sizing: border-box; padding: 4px 0; display: flex; flex-direction: column; align-items: center; justify-content: space-between; background: var(--s-chrome); border-right: 1px solid var(--s-border); position: relative; z-index: 20; }
.column { display: flex; flex-direction: column; align-items: center; }
.bottom { padding-bottom: 4px; }
.separator { width: 22px; height: 1px; margin: 6px 0; background: var(--s-border); }
.settings-anchor { position: relative; }
/* Opens to the right of the bar, with its bottom edge on the button. */
.settings { left: calc(100% + 6px); bottom: 0; width: 200px; }
.menu-group { padding: 8px 10px 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--s-text-2); }
.rule { height: 1px; margin: 4px; background: var(--s-border); }
.grow { flex: 1; }
.code { width: 24px; height: 18px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--s-border); border-radius: 4px; font-size: 10px; font-weight: 600; color: var(--s-text-2); }
</style>
