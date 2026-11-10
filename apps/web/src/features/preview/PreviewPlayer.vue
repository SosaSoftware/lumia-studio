<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { MediaRef, Pause, Slide } from '../../api/types.ts';
import CatalogElement from '../slide-components/CatalogElement.vue';
import type { SlideContext } from '../slide-components/slide-context.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import { t } from '../../i18n/index.ts';
import { slideFooter } from '../slides/slide-style.ts';
import SlideSurface from '../slides/SlideSurface.vue';
import { narrationDuration } from '../timeline/timeline-model.ts';
import StudioIcon from '../../ui/StudioIcon.vue';
import { advanceState, duePause, isFinished, isVisibleAt, stepIndex } from './preview-clock.ts';

const props = withDefaults(
  defineProps<{
    slides: Slide[];
    startIndex?: number;
    /** Media of the slides; by default the library of the open category. */
    media?: (id: string) => MediaRef | null;
    /** Class name of the footer; by default the open class. */
    className?: string | null;
    /** Whether a component is a question; by default the catalog of the editor. */
    isQuestion?: (component: string) => boolean;
    /** False for the public demo: no top bar, no controls, no Esc to close, and it fills its container. */
    chrome?: boolean;
    /** False waits for `play()` before the clock and the sound start; browsers block audio until a click. */
    autoStart?: boolean;
  }>(),
  { startIndex: 0, chrome: true, autoStart: true },
);
const emit = defineEmits<{ close: [] }>();
const running = ref(props.autoStart);

const TICK_MS = 100;
/** Time to read the feedback of the last question before an "Al completar" slide moves on. */
const COMPLETE_DELAY_MS = 2000;
/** Controls inside a slide; a click on them is an answer or an action, never "next slide". */
const CONTROLS = 'button, a, input, select, textarea, label, [role="button"], [role="option"], [role="radio"], [role="checkbox"], [role="tab"], [draggable="true"]';

const workspace = useWorkspace();
const index = ref(stepIndex(props.startIndex, 0, props.slides.length));
const elapsed = ref(0);
const ended = ref(false);
const pause = ref<Pause | null>(null);
const pauseLeft = ref(0);
const root = ref<HTMLElement | null>(null);
const reducedMotion = ref(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const played = new Set<string>();
const sounds = new Map<string, HTMLAudioElement>();
/** One audio element unlocked inside the first user gesture, so playback started later by the clock is allowed. */
let audioUnlock: HTMLAudioElement | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
let lastTick = 0;
let opener: Element | null = null;

const slide = computed(() => props.slides[index.value]);
/** Questions of the slide that are completed (answered correctly or out of attempts), as the components report them. */
const completed = ref(new Set<string>());
const questionIds = computed(() =>
  (slide.value?.elements ?? []).filter((element) => isQuestionComponent(element.component)).map((element) => element.id),
);
const advance = computed(() => advanceState(slide.value?.advance ?? 'click', questionIds.value, completed.value));
const hint = ref('');
let completeTimer: ReturnType<typeof setTimeout> | undefined;
const total = computed(() => props.slides.length);
const footerClass = computed(() => (props.className === undefined ? workspace.activeClass.value : props.className === null ? null : { displayName: props.className }));
const footer = computed(() => slideFooter(footerClass.value, index.value + 1));
const context: SlideContext = {
  elements: () => slide.value?.elements ?? [],
  media: (id) => (props.media === undefined ? workspace.media.get(id) : props.media(id)),
  navigator: {
    next: () => {
      go(1);
    },
    goTo: (position: number) => {
      go(position - 1 - index.value);
    },
  },
  questions: {
    report: (elementId, done) => {
      if (completed.value.has(elementId) === done) return;
      const next = new Set(completed.value);
      if (done) next.add(elementId);
      else next.delete(elementId);
      completed.value = next;
    },
  },
};

function isQuestionComponent(component: string): boolean {
  return props.isQuestion === undefined ? workspace.catalog.component(component)?.isQuestion === true : props.isQuestion(component);
}

function stopSounds(): void {
  for (const sound of sounds.values()) sound.pause();
  sounds.clear();
}

function setSoundsPaused(paused: boolean): void {
  for (const sound of sounds.values()) {
    if (paused) sound.pause();
    else void sound.play().catch(() => undefined);
  }
}

function start(): void {
  elapsed.value = 0;
  ended.value = false;
  pause.value = null;
  hint.value = '';
  clearTimeout(completeTimer);
  played.clear();
  stopSounds();
}

function playSound(id: string, url: string, offset: number, rate: number, volume: number): void {
  if (sounds.has(id)) return;
  const sound = new Audio(url);
  sound.playbackRate = rate;
  sound.volume = volume;
  sound.currentTime = Math.max(0, offset);
  sounds.set(id, sound);
  sound.play().catch(() => {
    // Without permission to play audio the slide continues silently.
  });
}

/**
 * Grants the page audio permission while the user gesture is still active. Browsers only allow audio that starts
 * inside a click; the narration of a slide usually starts a second later, from the clock, which the browser would
 * otherwise block. Playing a muted element now unlocks those later sounds.
 */
function unlockAudio(): void {
  if (audioUnlock !== null) return;
  const element = new Audio();
  element.muted = true;
  audioUnlock = element;
  element.play().catch(() => {
    // Some browsers need no unlock, or block even this; the slide then falls back to silent playback.
  });
}

/** Narration and audio clips play while the clock is inside them; a narration without voice is skipped. */
function syncSounds(current: Slide): void {
  for (const clip of current.narrationClips) {
    const end = clip.startsAtS + narrationDuration(clip);
    if (clip.status === 'ready' && clip.audioUrl !== null && elapsed.value >= clip.startsAtS && elapsed.value < end) {
      playSound(`n:${clip.id}`, clip.audioUrl, (elapsed.value - clip.startsAtS) * clip.speed, clip.speed, 1);
    }
  }
  for (const clip of current.audioClips) {
    if (clip.media !== null && elapsed.value >= clip.startsAtS && elapsed.value < clip.startsAtS + clip.durationS) {
      playSound(`a:${clip.id}`, clip.media.url, elapsed.value - clip.startsAtS, 1, clip.volume);
    }
    const sound = sounds.get(`a:${clip.id}`);
    if (sound !== undefined && elapsed.value >= clip.startsAtS + clip.durationS) {
      sound.pause();
      sounds.delete(`a:${clip.id}`);
    }
  }
}

function tick(): void {
  const now = Date.now();
  const delta = (now - lastTick) / 1000;
  lastTick = now;
  const current = slide.value;
  if (current === undefined || ended.value || !running.value) return;
  if (pause.value !== null) {
    if (pause.value.onEnd === 'continue') {
      pauseLeft.value = Math.max(0, pauseLeft.value - delta);
      if (pauseLeft.value <= 0) resume();
    }
    return;
  }
  elapsed.value += delta;
  const due = duePause(current.pauses, elapsed.value, played);
  if (due !== null) {
    played.add(due.id);
    pause.value = due;
    pauseLeft.value = due.durationS;
    setSoundsPaused(true);
    return;
  }
  syncSounds(current);
  if (isFinished(current, elapsed.value)) {
    if (index.value < total.value - 1) index.value += 1;
    else ended.value = true;
  }
}

function resume(): void {
  pause.value = null;
  setSoundsPaused(false);
}

function go(delta: number): void {
  if (delta > 0 && advance.value.blocked) {
    hint.value = t('preview.blockedHint');
    return;
  }
  const next = stepIndex(index.value, delta, total.value);
  if (next !== index.value) index.value = next;
  else if (delta > 0 && index.value === total.value - 1) ended.value = true;
}

/** A click on the slide moves on in "Con clic" and completed "Al completar" slides; clicks on controls are answers. */
function onStageClick(event: MouseEvent): void {
  if (pause.value?.onEnd === 'wait_click') {
    resume();
    return;
  }
  const target = event.target instanceof Element ? event.target.closest(CONTROLS) : null;
  if (pause.value !== null || (target !== null && root.value?.contains(target) === true)) return;
  const mode = slide.value?.advance;
  if (mode === 'click' || mode === 'on_complete') go(1);
}

// Once every question is completed, the slide moves on after a moment to read the feedback.
watch(
  () => advance.value.autoAdvance,
  (ready) => {
    clearTimeout(completeTimer);
    if (!ready) return;
    hint.value = '';
    const shown = index.value;
    completeTimer = setTimeout(() => {
      if (index.value === shown && pause.value === null) go(1);
    }, COMPLETE_DELAY_MS);
  },
);

function onKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'Escape':
      if (!props.chrome) break;
      event.preventDefault();
      emit('close');
      break;
    case 'ArrowRight':
    case 'PageDown':
      event.preventDefault();
      go(1);
      break;
    case 'ArrowLeft':
    case 'PageUp':
      event.preventDefault();
      go(-1);
      break;
    case ' ':
      if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLInputElement) return;
      event.preventDefault();
      if (pause.value !== null) resume();
      else go(1);
      break;
    default:
  }
}

watch(index, start);

/** Starts the clock and the sound; the demo calls it from its own button, after a click, so audio can play. */
function play(): void {
  if (running.value) return;
  unlockAudio();
  running.value = true;
  lastTick = Date.now();
  syncSounds(slide.value ?? ({ narrationClips: [], audioClips: [] } as unknown as Slide));
}

defineExpose({ play });

onMounted(() => {
  opener = document.activeElement;
  lastTick = Date.now();
  timer = setInterval(tick, TICK_MS);
  window.addEventListener('keydown', onKeydown);
  void nextTick(() => root.value?.focus());
});

onBeforeUnmount(() => {
  if (timer !== undefined) clearInterval(timer);
  clearTimeout(completeTimer);
  stopSounds();
  window.removeEventListener('keydown', onKeydown);
  if (opener instanceof HTMLElement) opener.focus();
});
</script>

<template>
  <div
    ref="root"
    class="preview"
    :class="{ embedded: !chrome }"
    :role="chrome ? 'dialog' : 'region'"
    :aria-modal="chrome ? 'true' : undefined"
    :aria-label="chrome ? t('preview.dialogLabel') : t('preview.embeddedLabel')"
    tabindex="-1"
    :data-reduced-motion="reducedMotion"
    data-testid="preview"
  >
    <div v-if="chrome" class="top">
      <span class="badge"><StudioIcon name="eye" :size="13" :stroke="2" /> {{ t('preview.badge') }}</span>
      <button type="button" class="close" :aria-label="t('preview.closeLabel')" :title="t('preview.closeShort')" data-testid="preview-close" @click="emit('close')">
        <StudioIcon name="close" :size="18" />
      </button>
    </div>
    <div class="stage" @click="onStageClick">
      <div v-if="slide" :key="slide.id" class="deck" :data-transition="slide.transition" :data-testid="`preview-slide-${index}`" :data-slide-id="slide.id">
        <SlideSurface :background="slide.background" :footer="footer" :context="context">
          <div
            v-for="element in slide.elements"
            :key="element.id"
            class="pe"
            :data-visible="isVisibleAt(element, elapsed)"
            :data-entrance="element.entrance"
            :data-testid="`preview-element-${element.id}`"
            :style="{ left: `${element.x}cqw`, top: `${element.y}cqw`, width: `${element.w}cqw`, height: `${element.h}cqw`, zIndex: element.z }"
          >
            <CatalogElement :element="element" mode="student" />
          </div>
          <div v-if="pause" class="pause" role="status" data-testid="preview-pause" @click.stop>
            <span class="pause-kicker">Pausa</span>
            <span class="pause-message">{{ pause.message || 'Tómate un momento.' }}</span>
            <span v-if="pause.onEnd === 'continue'" class="pause-time">Continúa en {{ Math.ceil(pauseLeft) }} s</span>
            <button v-else type="button" class="pause-go" data-testid="preview-pause-continue" @click="resume">Continuar</button>
          </div>
        </SlideSurface>
      </div>
    </div>
    <div v-if="chrome" class="controls">
      <button type="button" class="nav" :aria-label="t('slides.previous')" :disabled="index === 0" data-testid="preview-prev" @click="go(-1)"><StudioIcon name="chevron-left" :size="16" :stroke="2" /></button>
      <span class="count" aria-live="polite" data-testid="preview-count">{{ index + 1 }} / {{ total }}</span>
      <button
        type="button"
        class="nav"
        :aria-label="t('slides.next')"
        :aria-disabled="advance.blocked"
        :title="advance.blocked ? t('preview.blocked') : t('slides.next')"
        :disabled="index >= total - 1 && !advance.blocked"
        data-testid="preview-next"
        @click="go(1)"
      ><StudioIcon name="chevron-right" :size="16" :stroke="2" /></button>
      <span v-if="hint" class="hint" role="status" data-testid="preview-hint">{{ hint }}</span>
      <span v-else-if="ended" class="end" data-testid="preview-end">{{ t('preview.end') }}</span>
    </div>
  </div>
</template>

<style scoped>
.preview { position: fixed; inset: 0; z-index: 100; display: flex; flex-direction: column; background: var(--s-editor); color: var(--s-text); font-family: Lexend, system-ui, sans-serif; outline: none; }
.preview.embedded { position: relative; inset: auto; z-index: auto; height: 100%; }
.top { flex: none; height: 52px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px 0 16px; }
.badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; background: var(--s-hover); color: var(--s-text-2); font-size: 12px; }
.close { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: transparent; border: 1px solid var(--s-border); border-radius: 8px; color: var(--s-text); cursor: pointer; }
.close:hover { background: var(--s-hover); }
.close:focus-visible { outline: 2px solid var(--s-active); outline-offset: 2px; }
.stage { flex: 1 1 auto; min-height: 0; container-type: size; display: flex; align-items: center; justify-content: center; padding: 8px 32px; }
.deck { position: relative; width: min(100cqw, calc(100cqh * 16 / 9)); aspect-ratio: 16 / 9; border-radius: 8px; overflow: hidden; box-shadow: var(--s-stage-shadow), 0 0 0 1px var(--s-border); }
.controls { flex: none; height: 56px; display: flex; align-items: center; justify-content: center; gap: 14px; font-size: 13px; }
.count { min-width: 56px; text-align: center; font-variant-numeric: tabular-nums; }
.end { color: var(--s-accent-fg); }
.hint { color: var(--s-warn); }
.nav[aria-disabled='true'] { opacity: 0.35; cursor: not-allowed; }
.nav:disabled { opacity: 0.35; cursor: default; }
.pe { position: absolute; visibility: hidden; }
.pe[data-visible='true'] { visibility: visible; }
.pause { position: absolute; left: 50%; bottom: 6%; transform: translateX(-50%); min-width: 34%; max-width: 70%; box-sizing: border-box; padding: 1.4cqw 2cqw; display: flex; flex-direction: column; align-items: center; gap: 0.6cqw; text-align: center; background: var(--sl-card); color: var(--sl-ink); border-radius: 1.2cqw; box-shadow: 0 1cqw 3cqw var(--sl-shadow-2); font-size: 1.6cqw; z-index: 2000; }
.pause-kicker { font-size: 0.75em; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--sl-amber-ink); }
.pause-message { font-weight: 600; line-height: 1.35; }
.pause-time { font-size: 0.85em; color: var(--sl-ink-3); }
.pause-go { padding: 0.5em 1.2em; border: 0; border-radius: 0.6em; background: var(--sl-blue); color: var(--sl-white); font: inherit; font-weight: 600; cursor: pointer; }
.pause-go:focus-visible { outline: 0.2em solid var(--sl-blue); outline-offset: 0.15em; }
@keyframes pv-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes pv-slide { from { opacity: 0; transform: translateY(3cqw); } to { opacity: 1; transform: none; } }
@keyframes pv-draw { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
@keyframes pv-zoom { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: no-preference) {
  .pe[data-visible='true'][data-entrance='fade'] { animation: pv-fade 0.5s ease both; }
  .pe[data-visible='true'][data-entrance='slide'] { animation: pv-slide 0.5s ease both; }
  .pe[data-visible='true'][data-entrance='draw'] { animation: pv-draw 0.8s ease both; }
  .deck[data-transition='fade'] { animation: pv-fade 0.5s ease both; }
  .deck[data-transition='slide'] { animation: pv-slide 0.5s ease both; }
  .deck[data-transition='zoom'] { animation: pv-zoom 0.5s ease both; }
}
</style>
