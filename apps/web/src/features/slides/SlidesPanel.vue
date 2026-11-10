<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Slide } from '../../api/types.ts';
import { ACTIONS } from '../../composables/app-context.ts';
import { canChange } from '../../composables/edit-lock.ts';
import { useDismiss } from '../../composables/dismiss.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import { t } from '../../i18n/index.ts';
import ConfirmDialog from '../../ui/ConfirmDialog.vue';
import StudioIcon from '../../ui/StudioIcon.vue';
import { slideTypeName } from '../editor/catalog-labels.ts';
import { slideFooter } from './slide-style.ts';
import SlideThumbnail from './SlideThumbnail.vue';
import { REORDER_THRESHOLD_PX, SlideReorderSession } from './slide-reorder-session.ts';

const workspace = useWorkspace();
const session = workspace.session;
const slides = computed(() => session.state.slides);
const currentIndex = computed(() => slides.value.findIndex((slide) => slide.id === session.state.selectedSlideId));
const canEdit = computed(() => canChange(ACTIONS.edit) && workspace.activeClass.value !== null);
const position = computed(() => (slides.value.length > 0 && currentIndex.value >= 0 ? t('shell.statusBar.slideOf', { position: currentIndex.value + 1, total: slides.value.length }) : ''));

/** Widths of the menus, as in the design; their place is computed from the button that opens them. */
const THUMB_MENU_WIDTH = 132;
const MENU_GAP = 4;
const VIEWPORT_MARGIN = 8;

const menu = ref<string | null>(null);
const menuPlace = ref<Record<string, string>>({});
let menuTrigger: HTMLElement | null = null;
const menuEl = ref<HTMLElement | null>(null);
const strip = ref<HTMLElement | null>(null);
/** What the strip shows while a slide is dragged: which one, where it would land and how far it is from its place. */
interface ReorderView {
  id: string;
  from: number;
  target: number;
  offset: number;
  /** The slide is released and glides into its place before the move is made. */
  settling: boolean;
  /** Box of the empty place, in pixels of the scrolled content of the strip. */
  place: { top: number; width: number; height: number };
}
const SHIFT_MS = 160;
const SETTLE_MS = 140;
const reorder = ref<ReorderView | null>(null);
const announcement = ref('');
let press: { id: string; index: number; pointerId: number; startX: number; startY: number; element: HTMLElement } | null = null;
let reorderSession: SlideReorderSession | null = null;
let lastClientX = 0;
let scrollFrame = 0;
let settleTimer: ReturnType<typeof setTimeout> | undefined;
let suppressClick = false;
useDismiss(menuEl, () => menu.value !== null, () => {
  menu.value = null;
});

/** The menus are fixed to the window so the scrolling strip does not clip them; they close when it moves. */
function closeMenus(): void {
  menu.value = null;
}

onMounted(() => {
  window.addEventListener('resize', closeMenus);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', closeMenus);
  window.removeEventListener('keydown', onReorderKey);
  if (scrollFrame !== 0) cancelAnimationFrame(scrollFrame);
  clearTimeout(settleTimer);
});

function clampLeft(left: number, width: number): number {
  return Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - width - VIEWPORT_MARGIN));
}

async function focusFirstItem(selector: string): Promise<void> {
  await nextTick();
  document.querySelector<HTMLElement>(`${selector} [role="menuitem"]`)?.focus({ preventScroll: true });
}

function typeName(slide: Slide): string {
  const type = workspace.catalog.slideType(slide.type);
  return type === undefined ? slide.title : slideTypeName(type);
}

function footer(index: number): ReturnType<typeof slideFooter> {
  return slideFooter(workspace.activeClass.value, index + 1);
}

function select(id: string): void {
  session.selectSlide(id);
}

/** A click that ends a drag must not select the slide under the pointer. */
function onSelect(id: string): void {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  select(id);
}

async function go(index: number): Promise<void> {
  const target = slides.value[Math.min(Math.max(index, 0), slides.value.length - 1)];
  if (target === undefined) return;
  select(target.id);
  await nextTick();
  strip.value?.querySelector<HTMLElement>(`[data-testid="slide-thumb-${CSS.escape(target.id)}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function onThumbKey(event: KeyboardEvent, index: number): void {
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    void go(index + 1);
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    void go(index - 1);
  }
}

function setMenuEl(element: unknown, id: string): void {
  if (menu.value === id) menuEl.value = element instanceof HTMLElement ? element : null;
}

/** Opens the "more" menu under its button, aligned to the right as in the design. */
function toggleMenu(event: MouseEvent, id: string): void {
  if (menu.value === id) {
    menu.value = null;
    return;
  }
  const button = event.currentTarget;
  if (!(button instanceof HTMLElement)) return;
  const rect = button.getBoundingClientRect();
  menuTrigger = button;
  menuPlace.value = { left: `${String(clampLeft(rect.right - THUMB_MENU_WIDTH, THUMB_MENU_WIDTH))}px`, top: `${String(rect.bottom + MENU_GAP)}px` };
  menu.value = id;
  void focusFirstItem('.thumb-menu');
}

function escapeMenu(): void {
  closeMenus();
  menuTrigger?.focus();
}

function duplicate(id: string): void {
  menu.value = null;
  void session.duplicateSlide(id);
}

/** The slide that is waiting for the person to confirm its deletion. */
const pendingDelete = ref<string | null>(null);
const pendingSlide = computed(() => {
  const index = slides.value.findIndex((slide) => slide.id === pendingDelete.value);
  const slide = slides.value[index];
  return slide === undefined ? null : { id: slide.id, number: index + 1, title: slide.title };
});

/** Asks before deleting: a slide takes its elements, clips and notes with it. */
function remove(id: string): void {
  if (slides.value.length <= 1) return;
  menu.value = null;
  pendingDelete.value = id;
}

function confirmRemove(): void {
  const id = pendingSlide.value?.id;
  pendingDelete.value = null;
  if (id !== undefined) void session.deleteSlide(id);
}

function cancelRemove(): void {
  pendingDelete.value = null;
  menuTrigger?.focus();
}

function move(id: string, index: number): void {
  if (index < 0 || index >= slides.value.length) return;
  void session.moveSlide(id, index);
}

function add(): void {
  void session.addSlide();
}

/** Position of the pointer in the scrolled content of the strip. */
function contentX(clientX: number): number {
  const container = strip.value;
  return container === null ? clientX : clientX - container.getBoundingClientRect().left + container.scrollLeft;
}

function onThumbDown(event: PointerEvent, id: string, index: number): void {
  if (!canEdit.value || reorder.value !== null || event.button !== 0) return;
  // The buttons over the thumbnail (more actions, move) keep their own clicks.
  if (event.target instanceof Element && event.target.closest('.ov') !== null) return;
  if (!(event.currentTarget instanceof HTMLElement)) return;
  press = { id, index, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, element: event.currentTarget };
  lastClientX = event.clientX;
  suppressClick = false;
}

function onThumbMove(event: PointerEvent): void {
  if (press?.pointerId !== event.pointerId) return;
  lastClientX = event.clientX;
  if (reorderSession === null) {
    if (Math.hypot(event.clientX - press.startX, event.clientY - press.startY) < REORDER_THRESHOLD_PX) return;
    beginReorder(press);
  }
  updateReorder();
}

function beginReorder(held: NonNullable<typeof press>): void {
  const container = strip.value;
  if (container === null) return;
  const items = Array.from(container.querySelectorAll<HTMLElement>(':scope > .th'));
  const frame = held.element.querySelector<HTMLElement>('.frame');
  reorderSession = new SlideReorderSession(items.map((item) => item.offsetLeft), held.index, contentX(held.startX));
  reorder.value = {
    id: held.id,
    from: held.index,
    target: held.index,
    offset: 0,
    settling: false,
    place: { top: held.element.offsetTop + (frame?.offsetTop ?? 0), width: frame?.offsetWidth ?? 0, height: frame?.offsetHeight ?? 0 },
  };
  held.element.setPointerCapture(held.pointerId);
  select(held.id);
  closeMenus();
  suppressClick = true;
  window.addEventListener('keydown', onReorderKey);
  scrollFrame = requestAnimationFrame(scrollWhileDragging);
}

function updateReorder(): void {
  const view = reorder.value;
  if (view === null || reorderSession === null || view.settling) return;
  view.offset = reorderSession.offset(contentX(lastClientX));
  view.target = reorderSession.targetFor(view.offset);
}

/** Scrolls the strip while the pointer is near one of its ends, so a slide can be taken to a place out of view. */
function scrollWhileDragging(): void {
  const container = strip.value;
  const view = reorder.value;
  if (container === null || view === null || view.settling) {
    scrollFrame = 0;
    return;
  }
  const rect = container.getBoundingClientRect();
  const speed = SlideReorderSession.scrollSpeed(lastClientX, rect.left, rect.right);
  if (speed !== 0) {
    container.scrollLeft += speed;
    updateReorder();
  }
  scrollFrame = requestAnimationFrame(scrollWhileDragging);
}

function onThumbUp(event: PointerEvent): void {
  if (press?.pointerId !== event.pointerId) return;
  const { element, pointerId } = press;
  press = null;
  if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
  finishReorder(false);
}

function onThumbCancel(event: PointerEvent): void {
  if (press?.pointerId !== event.pointerId) return;
  press = null;
  finishReorder(true);
}

function onReorderKey(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || reorder.value === null) return;
  event.preventDefault();
  press = null;
  finishReorder(true);
}

/** The released slide glides into its place, and then the move is made: the order changes with no jump. */
function finishReorder(cancel: boolean): void {
  const view = reorder.value;
  const current = reorderSession;
  if (view === null || current === null || view.settling) return;
  window.removeEventListener('keydown', onReorderKey);
  const target = cancel ? view.from : view.target;
  view.target = target;
  view.offset = current.placeLeft(target) - current.placeLeft(view.from);
  view.settling = true;
  settleTimer = setTimeout(() => {
    const { id, from } = view;
    reorder.value = null;
    reorderSession = null;
    if (target === from) return;
    announcement.value = t('slides.moved', { position: target + 1, total: slides.value.length });
    void session.moveSlide(id, target);
  }, SETTLE_MS);
}

/** Inline style of a slide while one is dragged: the dragged one follows the pointer and the others open the gap. */
function itemStyle(index: number, id: string): Record<string, string> | undefined {
  const view = reorder.value;
  if (view === null || reorderSession === null) return undefined;
  if (id === view.id) return { transform: `translateX(${String(view.offset)}px)`, transition: view.settling ? `transform ${String(SETTLE_MS)}ms ease` : 'none' };
  return { transform: `translateX(${String(reorderSession.shiftOf(index, view.target))}px)`, transition: `transform ${String(SHIFT_MS)}ms ease` };
}

/** Box of the empty place where the dragged slide would land. */
function placeStyle(view: ReorderView): Record<string, string> {
  const left = reorderSession?.placeLeft(view.target) ?? 0;
  return { left: `${String(left)}px`, top: `${String(view.place.top)}px`, width: `${String(view.place.width)}px`, height: `${String(view.place.height)}px` };
}
</script>

<template>
  <section class="panel" :aria-label="t('slides.panel')" data-testid="panel-slides">
    <div class="head">
      <span class="lbl" data-testid="slides-count">{{ t('slides.count', { count: slides.length }) }}</span>
      <span class="pos">{{ position }}</span>
    </div>
    <div class="strip-row">
      <button type="button" class="nav" :aria-label="t('slides.previous')" data-testid="slides-prev" @click="go(currentIndex - 1)"><StudioIcon name="chevron-left" :size="14" :stroke="2" /></button>
      <div ref="strip" class="strip" role="list" :aria-label="t('slides.list')" :data-reordering="reorder !== null" @scroll.passive="closeMenus">
        <!-- Where the dragged slide would land; it moves along the strip with the pointer. -->
        <div v-if="reorder" class="place" :style="placeStyle(reorder)" aria-hidden="true" data-testid="slide-drop-place"></div>
        <div
          v-for="(slide, index) in slides"
          :key="slide.id"
          class="th"
          role="listitem"
          :data-on="slide.id === session.state.selectedSlideId"
          :data-drag="reorder?.id === slide.id"
          :data-editable="canEdit"
          :style="itemStyle(index, slide.id)"
          @pointerdown="onThumbDown($event, slide.id, index)"
          @pointermove="onThumbMove"
          @pointerup="onThumbUp"
          @pointercancel="onThumbCancel"
          @dragstart.prevent
        >
          <div class="frame" :style="{ boxShadow: slide.id === session.state.selectedSlideId ? '0 0 0 2px var(--s-active)' : '0 0 0 1px var(--s-border)' }">
            <SlideThumbnail :slide="slide" :footer="footer(index)" />
            <button
              type="button"
              class="thb"
              :aria-label="t('slides.slideLabel', { number: index + 1, title: slide.title })"
              :aria-current="slide.id === session.state.selectedSlideId"
              :title="slide.title"
              :data-testid="`slide-thumb-${slide.id}`"
              @click="onSelect(slide.id)"
              @keydown="onThumbKey($event, index)"
            ></button>
            <div v-if="canEdit" class="ov" role="group" :aria-label="t('slides.actions', { number: index + 1 })" style="top: 4px; right: 4px">
              <div :ref="(el) => setMenuEl(el, slide.id)" class="menu-anchor">
                <button
                  type="button"
                  class="ovb"
                  :aria-label="t('slides.moreActions', { number: index + 1 })"
                  :title="t('slides.moreActionsShort')"
                  aria-haspopup="menu"
                  :aria-expanded="menu === slide.id"
                  :data-testid="`slide-menu-${slide.id}`"
                  @click="toggleMenu($event, slide.id)"
                ><StudioIcon name="more" :size="13" :stroke="2.6" /></button>
                <div v-if="menu === slide.id" class="s-menu thumb-menu" role="menu" :aria-label="t('slides.actions', { number: index + 1 })" :style="menuPlace" @keydown.esc="escapeMenu">
                  <button type="button" role="menuitem" class="mi small" :data-testid="`slide-duplicate-${slide.id}`" @click="duplicate(slide.id)"><StudioIcon name="copy" :size="13" :stroke="2" />{{ t('slides.duplicate') }}</button>
                  <button
                    type="button"
                    role="menuitem"
                    class="mi small danger"
                    :aria-disabled="slides.length <= 1"
                    :title="slides.length <= 1 ? t('slides.needOne') : t('slides.deleteSlide', { number: index + 1 })"
                    :style="{ opacity: slides.length <= 1 ? 0.45 : 1 }"
                    :data-testid="`slide-delete-${slide.id}`"
                    @click="remove(slide.id)"
                  ><StudioIcon name="trash" :size="13" :stroke="2" />{{ t('slides.delete') }}</button>
                </div>
              </div>
            </div>
            <div v-if="canEdit" class="ov mv" role="group" :aria-label="t('slides.move', { number: index + 1 })" style="left: 4px; bottom: 4px">
              <button type="button" class="ovb" :aria-label="t('slides.moveLeft', { number: index + 1 })" :title="t('slides.moveLeftShort')" :aria-disabled="index === 0" :data-testid="`slide-move-left-${slide.id}`" @click="move(slide.id, index - 1)"><StudioIcon name="chevron-left" :size="12" :stroke="2.4" /></button>
              <button type="button" class="ovb" :aria-label="t('slides.moveRight', { number: index + 1 })" :title="t('slides.moveRightShort')" :aria-disabled="index === slides.length - 1" :data-testid="`slide-move-right-${slide.id}`" @click="move(slide.id, index + 1)"><StudioIcon name="chevron-right" :size="12" :stroke="2.4" /></button>
            </div>
          </div>
          <span class="cap" :style="{ color: slide.id === session.state.selectedSlideId ? 'var(--s-text)' : 'var(--s-text-2)' }"><span class="n">{{ index + 1 }}</span><span class="t">{{ typeName(slide) }}</span></span>
        </div>

        <div v-if="canEdit" class="add-anchor">
          <button type="button" class="add" :aria-label="t('slides.newBlank')" :title="t('slides.newBlank')" data-testid="slides-add" @click="add">
            <StudioIcon name="plus" :size="15" />
          </button>
        </div>
      </div>
      <button type="button" class="nav" :aria-label="t('slides.next')" data-testid="slides-next" @click="go(currentIndex + 1)"><StudioIcon name="chevron-right" :size="14" :stroke="2" /></button>
    </div>
    <div class="sr-only" role="status" aria-live="polite">{{ announcement }}</div>
    <ConfirmDialog
      v-if="pendingSlide"
      :title="t('slides.confirmDeleteTitle', { number: pendingSlide.number })"
      :message="t('slides.confirmDeleteMessage', { title: pendingSlide.title })"
      :confirm-label="t('slides.delete')"
      danger
      @confirm="confirmRemove"
      @cancel="cancelRemove"
    />
  </section>
</template>

<style scoped>
.panel { flex: 1 1 0; min-height: 132px; max-height: 176px; display: flex; flex-direction: column; background: var(--s-chrome); border-top: 1px solid var(--s-border); }
.head { flex: none; height: 28px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px 0 14px; }
.pos { font-size: 12px; color: var(--s-text-2); }
.strip-row { flex: 1 1 auto; min-height: 0; display: flex; align-items: center; gap: 8px; padding: 0 10px 10px; }
.strip { position: relative; flex: 1 1 auto; min-width: 0; height: 100%; display: flex; align-items: center; gap: 10px; overflow-x: auto; overflow-y: hidden; padding: 2px 4px; }
.th { user-select: none; -webkit-user-select: none; touch-action: pan-x; }
.th[data-editable='true'] { cursor: grab; }
/* The slide that is dragged rises above the others and follows the pointer. */
.th[data-drag='true'] { position: relative; z-index: 6; cursor: grabbing; }
.th[data-drag='true'] .frame { transform: scale(1.04); opacity: 0.94; box-shadow: 0 0 0 2px var(--s-active), 0 6px 14px rgba(0, 0, 0, 0.4) !important; }
/* The empty place, drawn under the slides: the others have moved aside, so it stays in view. */
.place { position: absolute; box-sizing: border-box; border: 2px dashed var(--s-active); border-radius: 6px; background: color-mix(in srgb, var(--s-active) 14%, transparent); pointer-events: none; transition: left 160ms ease; }
.frame { position: relative; width: 150px; aspect-ratio: 16 / 9; border-radius: 5px; }
.menu-anchor { position: relative; display: flex; }
.thumb-menu { position: fixed; width: 132px; z-index: 60; }
.mi.small { min-height: 28px; gap: 8px; padding: 0 8px; font-size: 12px; }
.mi.danger { color: var(--s-danger); }
.mi[aria-disabled='true'] { cursor: not-allowed; }
.cap { display: flex; gap: 6px; font-size: 11px; color: var(--s-text-2); }
.cap .n { font-weight: 600; }
.cap .t { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.add-anchor { position: relative; flex: none; margin-bottom: 20px; }
.add { width: 150px; aspect-ratio: 16 / 9; display: flex; align-items: center; justify-content: center; background: transparent; border: 1px dashed var(--s-border); border-radius: 5px; color: var(--s-text-2); cursor: pointer; }
.add:hover { background: var(--s-hover); color: var(--s-text); }
.add:focus-visible { outline: 2px solid var(--s-active); outline-offset: 1px; }
</style>
