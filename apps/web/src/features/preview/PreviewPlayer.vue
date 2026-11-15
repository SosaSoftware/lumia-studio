<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { MediaRef, Pause, Slide, SlideElement } from '../../api/types.ts';
import CatalogElement from '../slide-components/CatalogElement.vue';
import type { SlideContext } from '../slide-components/slide-context.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import { t } from '../../i18n/index.ts';
import { slideFooter } from '../slides/slide-style.ts';
import SlideSurface from '../slides/SlideSurface.vue';
import { narrationDuration } from '../timeline/timeline-model.ts';
import StudioIcon from '../../ui/StudioIcon.vue';
import { activeCustomButton, activeStartButton } from '../slides/slide-buttons.ts';
import { duePause, elementPhase, isVisibleAt, nextState, stepIndex, timeState } from './preview-clock.ts';

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
    /** False for the public demo: no top bar, no slide counter, no Esc to close, and it fills its container. The side buttons always show. */
    chrome?: boolean;
    /** False waits for `play()` before the clock and the sound start; browsers block audio until a click. */
    autoStart?: boolean;
  }>(),
  { startIndex: 0, chrome: true, autoStart: true },
);
const emit = defineEmits<{ close: [] }>();
const running = ref(props.autoStart);

const TICK_MS = 100;
/** Layer that holds a slide waiting for its start button; only that button sits above it. */
const HOLD_Z = 1500;
/** How long the Next button pulses once it turns on, so the student notices it. */
const PULSE_MS = 1800;

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
/** The button that starts the slide, when the slide waits for the time and starts with a button. */
const startButton = computed(() => (slide.value === undefined ? null : activeStartButton(slide.value)));
/** The button that replaces the lateral Next. */
const customButton = computed(() => (slide.value === undefined ? null : activeCustomButton(slide.value)));
/** A slide that waits for its start button holds its clock, sounds and components until the student presses it. */
const started = ref(startButton.value === null);
/** Slides whose Next button already turned on in this session: going back to them never locks the student again. */
const unlocked = ref(new Set<string>());
const next = computed(() => {
  const current = slide.value;
  const done = questionIds.value.filter((id) => completed.value.has(id)).length;
  return nextState({
    unlock: current?.unlock ?? 'always',
    time: timeState(current?.durationS ?? 0, elapsed.value),
    activities: { total: questionIds.value.length, completed: done },
    hasCustomButton: customButton.value !== null,
    unlockedBefore: current !== undefined && unlocked.value.has(current.id),
  });
});
/** A pause that waits for Next turns the button on: pressing it resumes the slide. */
const waitingPause = computed(() => pause.value?.onEnd === 'wait_next');
const nextReady = computed(() => !ended.value && (waitingPause.value || next.value.enabled));
/** The slide waits for its start button: a layer keeps every other component from answering. */
const holding = computed(() => !started.value && startButton.value !== null);
const pulse = ref(false);
const hint = ref('');
let pulseTimer: ReturnType<typeof setTimeout> | undefined;

/** Text of a button, as the student reads it. */
function buttonLabel(element: SlideElement | null): string {
  if (element === null) return '';
  return typeof element.props.label === 'string' && element.props.label.trim() !== '' ? element.props.label : element.name;
}

/** Why the lateral Next is off. */
const waitText = computed(() => {
  if (!started.value && startButton.value !== null) return t('preview.waitStart', { label: buttonLabel(startButton.value) });
  switch (next.value.waitsFor) {
    case 'time':
      return t('preview.waitTime');
    case 'activities':
      return t('preview.waitActivities');
    case 'button':
      return t('preview.waitButton', { label: buttonLabel(customButton.value) });
    default:
      return '';
  }
});
const total = computed(() => props.slides.length);
const footerClass = computed(() => (props.className === undefined ? workspace.activeClass.value : props.className === null ? null : { displayName: props.className }));
const footer = computed(() => slideFooter(footerClass.value, index.value + 1));
const context: SlideContext = {
  elements: () => slide.value?.elements ?? [],
  media: (id) => (props.media === undefined ? workspace.media.get(id) : props.media(id)),
  navigator: {
    next: (from) => {
      go(1, isCustomButton(from));
    },
    goTo: (position, from) => {
      go(position - 1 - index.value, isCustomButton(from));
    },
    start: (from) => {
      if (started.value || from !== startButton.value?.id) return false;
      begin();
      return true;
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

/** Whether `from` is the custom button of the slide, which moves on even while the lateral Next is off. */
function isCustomButton(from: string | undefined): boolean {
  return from !== undefined && from === customButton.value?.id;
}

/** Starts a slide that waited for its start button: from now on its clock runs. */
function begin(): void {
  started.value = true;
  hint.value = '';
  lastTick = Date.now();
  const current = slide.value;
  if (current !== undefined) syncSounds(current);
}

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
  started.value = startButton.value === null;
  elapsed.value = 0;
  ended.value = false;
  pause.value = null;
  hint.value = '';
  pulse.value = false;
  clearTimeout(pulseTimer);
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
  if (current === undefined || ended.value || !running.value || !started.value) return;
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
}

function resume(): void {
  pause.value = null;
  setSoundsPaused(false);
}

/**
 * Moves through the deck. Forward needs the Next button on; a pause that waits for Next resumes instead. The last
 * slide ends the class. `bypass` is the custom button of the slide, which moves on while the lateral Next is off.
 */
function go(delta: number, bypass = false): void {
  if (delta > 0) {
    if (waitingPause.value && !bypass) {
      resume();
      return;
    }
    if (!bypass && !next.value.enabled) {
      hint.value = waitText.value;
      return;
    }
    if (index.value === total.value - 1) {
      hint.value = '';
      ended.value = true;
      return;
    }
  }
  const target = stepIndex(index.value, delta, total.value);
  if (target !== index.value) index.value = target;
}

// The Next button turning on is remembered for the slide and pulses for a moment, so the student notices it.
watch(
  () => next.value.enabled,
  (enabled, before) => {
    const current = slide.value;
    if (!enabled || current === undefined) return;
    if (!unlocked.value.has(current.id)) unlocked.value = new Set([...unlocked.value, current.id]);
    hint.value = '';
    if (before === false) {
      pulse.value = true;
      clearTimeout(pulseTimer);
      pulseTimer = setTimeout(() => {
        pulse.value = false;
      }, PULSE_MS);
    }
  },
  { immediate: true },
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
  clearTimeout(pulseTimer);
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
    <div class="stage">
      <button type="button" class="side side-prev" :aria-label="t('slides.previous')" :title="t('slides.previous')" :disabled="index === 0" data-testid="preview-prev" @click="go(-1)">
        <StudioIcon name="chevron-left" :size="28" :stroke="2.4" />
      </button>
      <div v-if="slide" :key="slide.id" class="deck" :data-transition="slide.transition" :data-testid="`preview-slide-${index}`" :data-slide-id="slide.id">
        <SlideSurface :background="slide.background" :footer="footer" :context="context">
          <div
            v-for="element in slide.elements"
            :key="element.id"
            class="pe"
            :data-visible="isVisibleAt(element, elapsed) || (holding && element.id === startButton?.id)"
            :data-entrance="element.entrance"
            :data-exit="element.exit"
            :data-leaving="elementPhase(element, elapsed) === 'leaving'"
            :data-testid="`preview-element-${element.id}`"
            :style="{ left: `${element.x}cqw`, top: `${element.y}cqw`, width: `${element.w}cqw`, height: `${element.h}cqw`, zIndex: holding && element.id === startButton?.id ? HOLD_Z + 1 : element.z }"
          >
            <CatalogElement :element="element" mode="student" />
          </div>
          <div v-if="holding" class="hold" :style="{ zIndex: HOLD_Z }" data-testid="preview-hold" aria-hidden="true"></div>
          <div v-if="pause" class="pause" role="status" data-testid="preview-pause">
            <span class="pause-kicker">Pausa</span>
            <span class="pause-message">{{ pause.message || 'Tómate un momento.' }}</span>
            <span v-if="pause.onEnd === 'continue'" class="pause-time">Continúa en {{ Math.ceil(pauseLeft) }} s</span>
            <span v-else class="pause-time" data-testid="preview-pause-next">{{ t('preview.pauseNext') }}</span>
          </div>
        </SlideSurface>
      </div>
      <button
        type="button"
        class="side side-next"
        :class="{ pulse }"
        :style="{ '--progress': nextReady ? 1 : next.progress }"
        :aria-label="index === total - 1 ? t('preview.finish') : t('slides.next')"
        :aria-disabled="!nextReady"
        :title="nextReady ? (index === total - 1 ? t('preview.finish') : t('slides.next')) : waitText"
        :disabled="ended"
        :data-ready="nextReady"
        data-testid="preview-next"
        @click="go(1)"
      >
        <span class="side-fill" aria-hidden="true"></span>
        <StudioIcon name="chevron-right" :size="28" :stroke="2.4" />
      </button>
    </div>
    <div class="controls">
      <span v-if="chrome" class="count" aria-live="polite" data-testid="preview-count">{{ index + 1 }} / {{ total }}</span>
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
.stage { --side: clamp(44px, 6cqw, 84px); --gap: 12px; position: relative; flex: 1 1 auto; min-height: 0; container-type: size; display: flex; align-items: center; justify-content: center; gap: var(--gap); padding: 8px 16px; }
.deck { position: relative; width: min(calc(100cqw - 2 * (var(--side) + var(--gap))), calc(100cqh * 16 / 9)); aspect-ratio: 16 / 9; border-radius: 8px; overflow: hidden; box-shadow: var(--s-stage-shadow), 0 0 0 1px var(--s-border); }
/* Long buttons beside the slide: the only way forward or back, so a tap on the slide is never a step by mistake. */
.side { position: relative; flex: none; width: var(--side); height: min(100cqh, calc((100cqw - 2 * (var(--side) + var(--gap))) * 9 / 16)); display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 0; background: var(--s-hover); border: 1px solid var(--s-border); border-radius: 14px; color: var(--s-text); cursor: pointer; }
.side:hover:not(:disabled):not([aria-disabled='true']) { background: var(--s-active-soft); border-color: var(--s-active); }
.side:focus-visible { outline: 3px solid var(--s-active); outline-offset: 2px; }
.side:disabled { opacity: 0.3; cursor: default; }
.side > :deep(svg) { position: relative; }
.side-next[aria-disabled='true'] { color: var(--s-text-2); cursor: not-allowed; }
.side-next[data-ready='true'] { background: var(--s-active); border-color: var(--s-active); color: var(--s-on-active); }
/* While the slide is locked, the button fills from the bottom with what is done. */
.side-fill { position: absolute; inset: auto 0 0; height: calc(var(--progress, 0) * 100%); background: var(--s-active-soft); transition: height 0.3s linear; }
.side-next[data-ready='true'] .side-fill { display: none; }
@container (max-width: 640px) {
  .stage { --gap: 0px; padding: 8px; }
  .deck { width: min(100cqw, calc(100cqh * 16 / 9)); }
  .side { position: absolute; z-index: 3; top: 50%; transform: translateY(-50%); height: 60cqh; width: 40px; background: var(--s-panel); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25); }
  .side-prev { left: 4px; }
  .side-next { right: 4px; }
}
@keyframes pv-pulse { 0%, 100% { box-shadow: 0 0 0 0 var(--s-active-soft); } 50% { box-shadow: 0 0 0 10px var(--s-active-soft); } }
.controls { flex: none; height: 44px; display: flex; align-items: center; justify-content: center; gap: 14px; font-size: 13px; }
.count { min-width: 56px; text-align: center; font-variant-numeric: tabular-nums; }
.end { color: var(--s-accent-fg); }
.hint { color: var(--s-warn); }
.pe { position: absolute; visibility: hidden; }
.pe[data-visible='true'] { visibility: visible; }
.hold { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.08); cursor: not-allowed; }
.pause { position: absolute; left: 50%; bottom: 6%; transform: translateX(-50%); min-width: 34%; max-width: 70%; box-sizing: border-box; padding: 1.4cqw 2cqw; display: flex; flex-direction: column; align-items: center; gap: 0.6cqw; text-align: center; background: var(--sl-card); color: var(--sl-ink); border-radius: 1.2cqw; box-shadow: 0 1cqw 3cqw var(--sl-shadow-2); font-size: 1.6cqw; z-index: 2000; }
.pause-kicker { font-size: 0.75em; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--sl-amber-ink); }
.pause-message { font-weight: 600; line-height: 1.35; }
.pause-time { font-size: 0.85em; color: var(--sl-ink-3); }
@keyframes pv-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes pv-slide { from { opacity: 0; transform: translateY(3cqw); } to { opacity: 1; transform: none; } }
@keyframes pv-draw { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
@keyframes pv-zoom { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: none; } }
@keyframes pv-fade-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes pv-slide-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(3cqw); } }
@media (prefers-reduced-motion: no-preference) {
  .side-next.pulse { animation: pv-pulse 0.9s ease-in-out 2; }
  .pe[data-visible='true'][data-entrance='fade'] { animation: pv-fade 0.5s ease both; }
  .pe[data-visible='true'][data-entrance='slide'] { animation: pv-slide 0.5s ease both; }
  .pe[data-visible='true'][data-entrance='draw'] { animation: pv-draw 0.8s ease both; }
  .pe[data-leaving='true'][data-exit='fade'] { animation: pv-fade-out 0.5s ease both; }
  .pe[data-leaving='true'][data-exit='slide'] { animation: pv-slide-out 0.5s ease both; }
  .deck[data-transition='fade'] { animation: pv-fade 0.5s ease both; }
  .deck[data-transition='slide'] { animation: pv-slide 0.5s ease both; }
  .deck[data-transition='zoom'] { animation: pv-zoom 0.5s ease both; }
}
</style>
