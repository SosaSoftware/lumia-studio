<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { ACTIONS } from '../composables/app-context.ts';
import { canChange, changeDenial } from '../composables/edit-lock.ts';
import { t } from '../i18n/index.ts';
import { isPaletteGroup, openPanel, panels, toggleLeft } from '../composables/panels.ts';
import { useWorkspace } from '../composables/workspace.ts';
import CommentsPanel from '../features/comments/CommentsPanel.vue';
import SlideCanvas from '../features/editor/SlideCanvas.vue';
import LumiPanel from '../features/lumi/LumiPanel.vue';
import PreviewPlayer from '../features/preview/PreviewPlayer.vue';
import PropertiesPanel from '../features/properties/PropertiesPanel.vue';
import { slideFooter } from '../features/slides/slide-style.ts';
import SlidesPanel from '../features/slides/SlidesPanel.vue';
import TimelinePanel from '../features/timeline/TimelinePanel.vue';
import ActivityBar from '../features/shell/ActivityBar.vue';
import ClassTabs from '../features/workspace/ClassTabs.vue';
import ComponentPalette from '../features/palette/ComponentPalette.vue';
import ContentTree from '../features/tree/ContentTree.vue';
import LumiStar from '../ui/LumiStar.vue';
import SideBar from '../features/shell/SideBar.vue';
import StatusBar from '../features/shell/StatusBar.vue';
import StudioIcon from '../ui/StudioIcon.vue';
import TopBar from '../features/shell/TopBar.vue';
import WorkspaceToasts from '../features/shell/WorkspaceToasts.vue';

const workspace = useWorkspace();
const session = workspace.session;

const hasTabs = computed(() => workspace.openIds.value.length > 0);
const hasClass = computed(() => workspace.activeClass.value !== null);
const slides = computed(() => session.state.slides);
const shownSlide = computed(() => session.currentSlide);
const showCanvas = computed(() => hasClass.value && !session.state.loading && session.state.loadError === null && slides.value.length > 0);
const hasDeck = computed(() => hasClass.value && slides.value.length > 0);
const canEdit = computed(() => canChange(ACTIONS.edit));
const className = computed(() => workspace.activeClass.value?.displayName ?? '');
const leftGroup = computed(() => (hasClass.value && isPaletteGroup(panels.left) ? panels.left : null));
const slidePosition = computed(() => {
  const slide = shownSlide.value;
  if (slide === null) return { position: 0, total: 0 };
  const index = slides.value.findIndex((candidate) => candidate.id === slide.id);
  return { position: index + 1, total: slides.value.length };
});
const footer = computed(() => slideFooter(workspace.activeClass.value, slidePosition.value.position));
const startIndex = computed(() => Math.max(slides.value.findIndex((slide) => slide.id === session.state.selectedSlideId), 0));

onMounted(() => {
  void workspace.init();
  window.addEventListener('beforeunload', flushOnLeave);
});

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', flushOnLeave);
});

function flushOnLeave(): void {
  void session.flush();
}

/** Goes to the previous or the next slide, from the arrows beside the canvas. */
function stepSlide(direction: -1 | 1): void {
  const target = slides.value[startIndex.value + direction];
  if (target !== undefined) session.selectSlide(target.id);
}

function addFirstSlide(): void {
  if (canEdit.value) void session.addSlide();
}

function dropComponent(component: string, x: number, y: number): void {
  const size = workspace.catalog.component(component)?.defaultSize;
  void session.addElement(component, size === undefined ? { x, y } : { x: x - size.w / 2, y: y - size.h / 2 });
}
</script>

<template>
  <div class="ws" data-testid="workspace">
    <TopBar />
    <div class="body">
      <ActivityBar />
      <ComponentPalette v-if="leftGroup" :group="leftGroup" />
      <ContentTree v-else-if="panels.left === 'explorer'" />

      <main class="center" :aria-label="t('workspace.page.editor')">
        <ClassTabs v-if="hasTabs" />

        <template v-if="hasTabs">
          <div v-if="session.state.loading" class="empty" role="status"><p class="muted">{{ t('workspace.page.loading') }}</p></div>
          <div v-else-if="session.state.loadError" class="empty" role="alert" data-testid="load-error">
            <div class="box">
              <StudioIcon name="alert-circle" :size="28" />
              <p>{{ session.state.loadError }}</p>
              <button type="button" class="prv" @click="workspace.activeClass.value && session.open(workspace.activeClass.value)">{{ t('common.retry') }}</button>
            </div>
          </div>
          <template v-else-if="showCanvas && shownSlide">
            <SlideCanvas
              :slide="shownSlide"
              :selected-element-id="session.state.selectedElementId"
              :position="slidePosition.position"
              :total="slidePosition.total"
              :editable="canEdit"
              :footer="footer"
              :navigation="panels.bottom === 'timeline'"
              @select-element="session.selectElement($event)"
              @select-slide="workspace.showSlide()"
              @step="stepSlide"
              @geometry="(id, geometry) => session.updateGeometry(id, geometry)"
              @remove-element="session.deleteElement($event)"
              @drop-component="dropComponent"
              @fit-height="(id, height, bound) => session.reportHeight(id, height, bound)"
            />
            <TimelinePanel v-if="panels.bottom === 'timeline' && hasDeck" />
            <SlidesPanel v-else-if="panels.bottom === 'slides' || !hasDeck" />
          </template>
          <div v-else-if="hasClass" class="empty" data-testid="no-content">
            <div class="box">
              <LumiStar :size="40" />
              <h2>{{ t('workspace.page.emptyTitle', { name: className }) }}</h2>
              <p>{{ t('workspace.page.emptyHint') }}</p>
              <button type="button" class="cta" :aria-disabled="!canEdit" :title="canEdit ? t('workspace.page.addBlank') : changeDenial('workspace.page.noPermissionEditClass')" data-testid="add-first-slide" @click="addFirstSlide">
                <StudioIcon name="plus" :size="13" :stroke="2" /> {{ t('workspace.page.addSlide') }}
              </button>
            </div>
          </div>
        </template>

        <div v-else class="empty" data-testid="workspace-empty">
          <div class="welcome">
            <LumiStar :size="150" :opacity="0.08" />
            <h1 class="sr-only">Lumia Studio</h1>
            <dl>
              <dt>{{ t('workspace.page.openClass') }}</dt>
              <dd><span class="kbd">{{ t('workspace.page.openClassHow') }}</span></dd>
              <dt>{{ t('workspace.page.toggleExplorer') }}</dt>
              <dd><button type="button" class="kbd" data-testid="shortcut-explorer" @click="toggleLeft('explorer')"><StudioIcon name="explorer" :size="14" /> {{ t('shell.activity.explorer') }}</button></dd>
              <dt>{{ t('workspace.page.askLumi') }}</dt>
              <dd><button type="button" class="kbd" data-testid="shortcut-lumi" @click="openPanel('lumi')"><LumiStar :size="14" /> Lumi</button></dd>
            </dl>
          </div>
        </div>
      </main>

      <LumiPanel v-if="panels.right === 'lumi'" />
      <PropertiesPanel v-else-if="panels.right === 'properties' && (hasDeck || workspace.inspectedNode.value !== null)" />
      <CommentsPanel v-else-if="panels.right === 'comments' && hasDeck" />
      <SideBar />
    </div>
    <StatusBar />
    <WorkspaceToasts />

    <PreviewPlayer v-if="workspace.previewOpen.value && slides.length > 0" :slides="slides" :start-index="startIndex" @close="workspace.previewOpen.value = false" />
  </div>
</template>

<style scoped>
.ws { height: 100vh; min-height: 640px; display: flex; flex-direction: column; background: var(--s-editor); color: var(--s-text); font-family: Lexend, system-ui, sans-serif; font-size: 13px; overflow: hidden; }
.body { flex: 1 1 auto; min-height: 0; display: flex; }
.center { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; background: var(--s-editor); }
.empty { flex: 1 1 auto; display: flex; align-items: center; justify-content: center; padding: 24px; }
.box { max-width: 420px; display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; }
.box h2 { margin: 0; font-size: 18px; font-weight: 500; }
.box p { margin: 0; line-height: 1.55; color: var(--s-text-2); }
.muted { margin: 0; color: var(--s-text-2); }
.welcome { display: flex; flex-direction: column; align-items: center; gap: 30px; }
dl { margin: 0; display: grid; grid-template-columns: auto auto; align-items: center; gap: 14px 18px; font-size: 13px; }
dt { color: var(--s-text-2); text-align: right; }
dd { margin: 0; }
button.kbd { cursor: pointer; font: inherit; font-size: 12px; }
button.kbd:hover { border-color: var(--s-text-2); }
.cta { height: 34px; display: flex; align-items: center; gap: 8px; padding: 0 14px; background: var(--s-active); border: 0; border-radius: 7px; color: var(--s-on-active); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }
.cta:hover { background: var(--s-active-hover); }
.cta:disabled { opacity: 0.6; cursor: progress; }
.cta:focus-visible { outline: 2px solid var(--s-active); outline-offset: 2px; }
</style>
