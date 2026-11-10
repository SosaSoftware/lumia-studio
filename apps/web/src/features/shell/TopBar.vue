<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ACTIONS, useApp } from '../../composables/app-context.ts';
import { editLock } from '../../composables/edit-lock.ts';
import { useDismiss } from '../../composables/dismiss.ts';
import { resetWorkspace, useWorkspace } from '../../composables/workspace.ts';
import { describeClass } from '../workspace/class-status.ts';
import { badgeOf, groupByName } from '../workspace/scope-model.ts';
import { t } from '../../i18n/index.ts';
import StudioIcon from '../../ui/StudioIcon.vue';
import { initialsOf } from './user-display.ts';

const app = useApp();
const router = useRouter();
const workspace = useWorkspace();
const session = workspace.session;

type Menu = 'category' | 'subcategory' | 'account';
const menu = ref<Menu | null>(null);
const categoryMenu = ref<HTMLElement | null>(null);
const subcategoryMenu = ref<HTMLElement | null>(null);
const categoryGroups = computed(() => groupByName(workspace.categories.value));
const subcategoryGroups = computed(() => groupByName(workspace.category.value?.subcategories ?? []));
const accountMenu = ref<HTMLElement | null>(null);
useDismiss(categoryMenu, () => menu.value === 'category', close);
useDismiss(subcategoryMenu, () => menu.value === 'subcategory', close);
useDismiss(accountMenu, () => menu.value === 'account', close);

function close(): void {
  menu.value = null;
}

function toggle(name: Menu): void {
  menu.value = menu.value === name ? null : name;
}

const node = computed(() => workspace.activeClass.value);
const view = computed(() =>
  describeClass({ hasClass: node.value !== null, document: session.state.document, slideCount: session.state.slides.length, canPublish: app.can(ACTIONS.publish), lockedReason: editLock.reason === null ? null : t(editLock.reason) }),
);
const STATUS_COLORS: Record<string, { fg: string; bg: string }> = {
  no_content: { fg: 'var(--s-text-2)', bg: 'var(--s-hover)' },
  draft: { fg: 'var(--s-warn)', bg: 'var(--s-warn-bg)' },
  published: { fg: 'var(--s-ok)', bg: 'var(--s-ok-bg)' },
};
const colors = computed(() => STATUS_COLORS[view.value.status] ?? { fg: 'var(--s-text-2)', bg: 'var(--s-hover)' });
const user = computed(() => app.user.value);
const initials = computed(() => initialsOf(user.value?.name ?? ''));
const role = computed(() => user.value?.roleName ?? '');

async function pickCategory(id: string): Promise<void> {
  close();
  await workspace.selectScope(id);
}

async function pickSubcategory(id: string): Promise<void> {
  close();
  const category = workspace.category.value;
  if (category !== null) await workspace.selectScope(category.id, id);
}

function preview(): void {
  if (!view.value.previewDisabled) workspace.previewOpen.value = true;
}

function publish(): void {
  if (!view.value.publishDisabled) void session.publish();
}

async function signOut(): Promise<void> {
  close();
  await session.flush();
  await app.signOut();
  resetWorkspace();
  await router.replace({ name: 'sign-in' });
}
</script>

<template>
  <header class="topbar" data-testid="topbar">
    <div class="start">
      <img src="/logos/icon.png" alt="Lumia Studio" class="logo" />
      <div v-if="workspace.category.value" ref="categoryMenu" class="menu-anchor">
        <button
          type="button"
          class="tb"
          aria-haspopup="listbox"
          :aria-expanded="menu === 'category'"
          :aria-label="t('shell.topBar.categoryCurrent', { name: workspace.category.value.displayName })"
          :style="{ background: menu === 'category' ? 'var(--s-hover)' : undefined }"
          data-testid="topbar-category"
          @click="toggle('category')"
        >
          <span class="s-badge" aria-hidden="true">{{ badgeOf(workspace.category.value.displayName) }}</span>
          <span class="strong">{{ workspace.category.value.displayName }}</span>
          <StudioIcon name="chevron-down" :size="14" :stroke="2" class="chev" />
        </button>
        <div v-if="menu === 'category'" class="s-menu list categories" role="listbox" :aria-label="t('shell.topBar.category')">
          <div v-for="group in categoryGroups" :key="group.name ?? ''" :role="group.name === null ? 'none' : 'group'" :aria-label="group.name ?? undefined">
            <div v-if="group.name !== null" class="menu-group" aria-hidden="true" data-testid="topbar-category-group">{{ group.name }}</div>
            <button
              v-for="category in group.items"
              :key="category.id"
              type="button"
              class="mi"
              :class="{ 'in-group': group.name !== null }"
              role="option"
              :aria-selected="category.id === workspace.category.value.id"
              :style="{ background: category.id === workspace.category.value.id ? 'var(--s-hover)' : undefined }"
              :data-testid="`topbar-category-${category.id}`"
              @click="pickCategory(category.id)"
            >
              <span class="s-badge" aria-hidden="true">{{ badgeOf(category.displayName) }}</span>
              <span class="grow">{{ category.displayName }}</span>
              <span v-if="category.id === workspace.category.value.id" class="s-check"><StudioIcon name="check" :size="14" :stroke="2.2" /></span>
            </button>
          </div>
        </div>
      </div>
      <div v-if="workspace.subcategory.value" ref="subcategoryMenu" class="menu-anchor shrink">
        <button
          type="button"
          class="tb"
          aria-haspopup="listbox"
          :aria-expanded="menu === 'subcategory'"
          :aria-label="t('shell.topBar.subcategoryCurrent', { name: workspace.subcategory.value.displayName })"
          :style="{ background: menu === 'subcategory' ? 'var(--s-hover)' : undefined }"
          data-testid="topbar-subcategory"
          @click="toggle('subcategory')"
        >
          <span class="book"><StudioIcon name="book" :size="15" /></span>
          <span class="ellipsis">{{ workspace.subcategory.value.displayName }}</span>
          <StudioIcon name="chevron-down" :size="14" :stroke="2" class="chev" />
        </button>
        <div v-if="menu === 'subcategory'" class="s-menu list subcategories" role="listbox" :aria-label="t('shell.topBar.subcategory')">
          <div v-for="group in subcategoryGroups" :key="group.name ?? ''" :role="group.name === null ? 'none' : 'group'" :aria-label="group.name ?? undefined">
            <div v-if="group.name !== null" class="menu-group" aria-hidden="true" data-testid="topbar-subcategory-group">{{ group.name }}</div>
            <button
              v-for="subcategory in group.items"
              :key="subcategory.id"
              type="button"
              class="mi"
              :class="{ 'in-group': group.name !== null }"
              role="option"
              :aria-selected="subcategory.id === workspace.subcategory.value.id"
              :style="{ background: subcategory.id === workspace.subcategory.value.id ? 'var(--s-hover)' : undefined }"
              :data-testid="`topbar-subcategory-${subcategory.id}`"
              @click="pickSubcategory(subcategory.id)"
            >
              <span class="book"><StudioIcon name="book" :size="15" /></span>
              <span class="grow">{{ subcategory.displayName }}</span>
              <span v-if="subcategory.id === workspace.subcategory.value.id" class="s-check"><StudioIcon name="check" :size="14" :stroke="2.2" /></span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="end">
      <div v-if="node" class="class-group" role="group" :aria-label="t('shell.topBar.openClass', { name: node.displayName })">
        <span class="status" :style="{ background: colors.bg, color: colors.fg }" :data-status="view.status" data-testid="topbar-status">
          <span class="dot" aria-hidden="true" :style="{ background: colors.fg }"></span>{{ view.statusLabel }}
        </span>
        <span v-if="view.versionLabel" class="version" :title="view.versionTip" data-testid="topbar-version">{{ view.versionLabel }}</span>
        <button type="button" class="prv" :aria-disabled="view.previewDisabled" :title="view.previewTip" data-testid="topbar-preview" @click="preview">
          <StudioIcon name="eye" :size="13" :stroke="2" />{{ t('shell.topBar.preview') }}
        </button>
        <button type="button" class="pub" :aria-disabled="view.publishDisabled" :title="view.publishTip" data-testid="topbar-publish" @click="publish">
          <StudioIcon name="upload" :size="13" :stroke="2" />{{ t('shell.topBar.publish') }}
        </button>
      </div>
      <div ref="accountMenu" class="menu-anchor">
        <button
          type="button"
          class="avatar"
          :title="`${user?.name ?? ''} · ${role}`"
          aria-haspopup="menu"
          :aria-expanded="menu === 'account'"
          :aria-label="t('shell.topBar.accountOf', { name: user?.name ?? '' })"
          data-testid="topbar-user"
          @click="toggle('account')"
        >{{ initials }}</button>
        <div v-if="menu === 'account'" class="s-menu account" role="menu" :aria-label="t('shell.topBar.account')">
          <div class="who">
            <span class="avatar big" aria-hidden="true">{{ initials }}</span>
            <span class="who-text"><strong>{{ user?.name }}</strong><span>{{ user?.email }}</span><span>{{ role }}</span></span>
          </div>
          <div class="sep" role="separator"></div>
          <button type="button" class="mi" role="menuitem" data-testid="topbar-signout" @click="signOut">
            <StudioIcon name="sign-out" :size="15" />{{ t('shell.topBar.signOut') }}
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.topbar { flex: none; height: 40px; box-sizing: border-box; display: flex; align-items: center; gap: 12px; padding: 0 10px 0 6px; background: var(--s-chrome); border-bottom: 1px solid var(--s-border); position: relative; z-index: 30; }
.start { flex: 1 0 auto; min-width: 0; display: flex; align-items: center; gap: 4px; }
.logo { width: 22px; height: 22px; border-radius: 5px; display: block; margin: 0 8px 0 7px; flex: none; }
.menu-anchor { position: relative; }
.menu-anchor.shrink { min-width: 0; }
.tb { max-width: 100%; }
.strong { font-weight: 500; }
.chev { color: var(--s-text-2); flex: none; }
.book { display: flex; color: var(--s-ico-subcategory); }
.ellipsis { overflow: hidden; text-overflow: ellipsis; }
.list { left: 0; top: calc(100% + 4px); }
.categories { width: 320px; }
.subcategories { width: 300px; }
.menu-group { padding: 8px 10px 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--s-text-2); }
.mi.in-group { padding-left: 20px; }
.group { display: flex; flex-direction: column; gap: 2px; }
.grow { flex: 1; }
.end { flex: 1 1 0; display: flex; align-items: center; justify-content: flex-end; gap: 4px; }
.class-group { display: flex; align-items: center; gap: 8px; margin-right: 10px; padding-right: 12px; border-right: 1px solid var(--s-border); }
.status { height: 24px; display: inline-flex; align-items: center; gap: 6px; padding: 0 10px; border-radius: 999px; font-size: 12px; white-space: nowrap; }
.dot { width: 7px; height: 7px; border-radius: 50%; }
.version { height: 24px; display: inline-flex; align-items: center; padding: 0 8px; border: 1px solid var(--s-border); border-radius: 6px; font-size: 12px; color: var(--s-text-2); white-space: nowrap; }
.avatar { width: 26px; height: 26px; margin-left: 4px; padding: 0; flex: none; border: 0; border-radius: 50%; background: var(--s-active); display: flex; align-items: center; justify-content: center; font: inherit; font-size: 10px; font-weight: 600; color: var(--s-on-active); cursor: pointer; }
.avatar:focus-visible { outline: 2px solid var(--s-active); outline-offset: 2px; }
.avatar.big { width: 32px; height: 32px; margin: 0; font-size: 12px; cursor: default; }
.account { right: 0; top: calc(100% + 6px); width: 260px; }
.who { display: flex; align-items: center; gap: 10px; padding: 8px 10px; }
.who-text { min-width: 0; display: flex; flex-direction: column; gap: 1px; font-size: 12px; color: var(--s-text-2); }
.who-text strong { color: var(--s-text); font-size: 13px; font-weight: 500; }
.sep { height: 1px; margin: 2px 4px; background: var(--s-border); }
</style>
