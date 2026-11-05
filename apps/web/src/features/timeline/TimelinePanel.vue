<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { rec, str } from '../../api/decode.ts';
import type { MediaAsset, SlideElement } from '../../api/types.ts';
import { ACTIONS } from '../../composables/app-context.ts';
import { canChange } from '../../composables/edit-lock.ts';
import { panels } from '../../composables/panels.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import MediaLibraryDialog from '../media/MediaLibraryDialog.vue';
import { groupColor } from '../palette/palette.ts';
import StudioIcon from '../../ui/StudioIcon.vue';
import { AUDIO_KIND_LABELS, ENTRANCE_LABELS, TRANSITION_LABELS, elementSpan, formatTime, narrationDuration, seekTarget, slideDuration, ticks, timeAtOffset, timerSeconds } from './timeline-model.ts';

type ClipKind = 'transition' | 'element' | 'narration' | 'audio' | 'pause';

interface Clip {
  kind: ClipKind;
  id: string;
  start: number;
  end: number;
  label: string;
  title: string;
  resizable: boolean;
}

interface Row {
  key: string;
  name: string;
  sub: string;
  dot: string;
  clips: Clip[];
  add?: () => void;
  addLabel?: string;
}

const workspace = useWorkspace();
const session = workspace.session;
const slide = computed(() => session.currentSlide);
const canEdit = computed(() => canChange(ACTIONS.edit));
const duration = computed(() => (slide.value === null ? 20 : slideDuration(slide.value)));
const marks = computed(() => ticks(duration.value));
const position = computed(() => session.state.slides.findIndex((candidate) => candidate.id === slide.value?.id) + 1);
const typeName = computed(() => (slide.value === null ? '' : (workspace.catalog.slideType(slide.value.type)?.name ?? slide.value.type)));
const libraryOpen = ref(false);

/** First text of a list prop: a string item or an item with a text-like field. */
function firstItemText(value: unknown): string {
  if (!Array.isArray(value)) return '';
  const first: unknown = value[0];
  if (typeof first === 'string') return first;
  const item = rec(first);
  return str(item.text) || str(item.label) || str(item.title) || str(item.caption);
}

function snippet(element: SlideElement): string {
  const props = element.props;
  const text = str(props.text) || str(props.question) || str(props.title) || str(props.statement) || str(props.label) || str(props.front) || firstItemText(props.items) || firstItemText(props.columns) || element.name;
  return text.length > 40 ? `${text.slice(0, 39)}…` : text;
}

function selected(clip: Clip): boolean {
  const selection = session.state.selectedClip;
  if (clip.kind === 'element') return session.state.selectedElementId === clip.id;
  if (clip.kind === 'transition') return selection?.kind === 'transition';
  return selection !== null && selection.kind === clip.kind && selection.id === clip.id;
}

const topRows = computed<Row[]>(() => {
  const current = slide.value;
  if (current === null) return [];
  const label = TRANSITION_LABELS[current.transition];
  return [{ key: 'transition', name: 'Transición', sub: label, dot: 'var(--tl-trans)', clips: [{ kind: 'transition', id: 'transition', start: 0, end: Math.min(1, duration.value), label, title: `Transición de entrada: ${label}`, resizable: false }] }];
});

const componentRows = computed<Row[]>(() => {
  const current = slide.value;
  if (current === null) return [];
  return current.elements
    .map((element, index) => ({ element, index }))
    .sort((a, b) => a.element.appearsAtS - b.element.appearsAtS || a.index - b.index)
    .map(({ element }) => {
      const info = workspace.catalog.component(element.component);
      const name = info?.name ?? element.component;
      const entrance = ENTRANCE_LABELS[element.entrance];
      const span = elementSpan(element, duration.value);
      const seconds = timerSeconds(element);
      const countdown = seconds === null ? '' : ` · cuenta ${formatTime(seconds)}${element.props.autoStart === true ? '' : ' cuando el estudiante lo inicia'}`;
      return {
        key: `element-${element.id}`,
        name,
        sub: snippet(element),
        dot: groupColor(info?.group ?? ''),
        clips: [{
          kind: 'element',
          id: element.id,
          start: span.start,
          end: span.end,
          label: seconds === null ? entrance : `${entrance} · ${formatTime(seconds)}`,
          title: `${name} · aparece en ${formatTime(element.appearsAtS)} · ${entrance}${countdown}`,
          resizable: false,
        }],
      };
    });
});

function openProperties(): void {
  panels.right = 'properties';
}

const audioRows = computed<Row[]>(() => {
  const current = slide.value;
  if (current === null) return [];
  const narration = current.narrationClips;
  const audio = current.audioClips;
  const pauses = current.pauses;
  return [
    {
      key: 'narration',
      name: 'Narración',
      sub: narration.length === 0 ? 'Sin clips' : `${String(narration.length)} ${narration.length === 1 ? 'clip de voz' : 'clips de voz'}`,
      dot: 'var(--tl-narr)',
      clips: narration.map((clip) => {
        const length = narrationDuration(clip);
        const text = clip.script.trim() === '' ? 'Nuevo clip (sin guion)' : clip.script;
        return { kind: 'narration', id: clip.id, start: clip.startsAtS, end: clip.startsAtS + length, label: text, title: `Narración ${formatTime(clip.startsAtS)}–${formatTime(clip.startsAtS + length)}: ${text}`, resizable: false };
      }),
      add: () => {
        void session.addNarration().then(openProperties);
      },
      addLabel: 'Agregar clip de narración',
    },
    {
      key: 'audio',
      name: 'Audio',
      sub: audio.length === 0 ? 'Sin audio' : 'Música y efectos',
      dot: 'var(--tl-audio)',
      clips: audio.map((clip) => ({
        kind: 'audio',
        id: clip.id,
        start: clip.startsAtS,
        end: clip.startsAtS + clip.durationS,
        label: `${AUDIO_KIND_LABELS[clip.kind]} · ${clip.name}`,
        title: `${AUDIO_KIND_LABELS[clip.kind]} ${formatTime(clip.startsAtS)}–${formatTime(clip.startsAtS + clip.durationS)}: ${clip.name}`,
        resizable: true,
      })),
      add: () => {
        libraryOpen.value = true;
      },
      addLabel: 'Agregar audio',
    },
    {
      key: 'pause',
      name: 'Pausas',
      sub: pauses.length === 0 ? 'Sin pausas' : 'Tiempo muerto',
      dot: 'var(--tl-pause)',
      clips: pauses.map((pause) => ({
        kind: 'pause',
        id: pause.id,
        start: pause.startsAtS,
        end: pause.startsAtS + pause.durationS,
        label: `Pausa ${String(pause.durationS)} s · ${pause.message}`,
        title: `Pausa ${formatTime(pause.startsAtS)}–${formatTime(pause.startsAtS + pause.durationS)}: ${pause.message}`,
        resizable: true,
      })),
      add: () => {
        void session.addPause().then(openProperties);
      },
      addLabel: 'Agregar pausa',
    },
  ];
});

function percent(time: number): string {
  return `${String((Math.max(0, Math.min(time, duration.value)) / duration.value) * 100)}%`;
}

function clipStyle(clip: Clip): Record<string, string> {
  const width = ((Math.min(clip.end, duration.value) - Math.max(0, clip.start)) / duration.value) * 100;
  return { left: percent(clip.start), width: `max(6px, ${String(width)}%)` };
}

function select(clip: Clip): void {
  if (clip.kind === 'element') session.selectElement(clip.id);
  else if (clip.kind === 'transition') session.selectClip({ kind: 'transition' });
  else session.selectClip({ kind: clip.kind, id: clip.id });
}

function selectRow(row: Row): void {
  const first = row.clips[0];
  if (first !== undefined) select(first);
}

// -- Moving and resizing clips --------------------------------------------

const round1 = (value: number): number => Math.round(value * 10) / 10;
let drag: { clip: Clip; mode: 'move' | 'resize'; x: number; width: number; moved: boolean } | null = null;

function apply(clip: Clip, start: number, length: number): void {
  if (clip.kind === 'element') session.updateElement(clip.id, { appearsAtS: start });
  else if (clip.kind === 'narration') session.updateNarration(clip.id, { startsAtS: start });
  else if (clip.kind === 'audio') session.updateAudio(clip.id, { startsAtS: start, durationS: length });
  else if (clip.kind === 'pause') session.updatePause(clip.id, { startsAtS: start, durationS: length });
}

function onPointerDown(event: PointerEvent, clip: Clip): void {
  if (!canEdit.value || clip.kind === 'transition' || event.button !== 0) return;
  const target = event.currentTarget;
  const track = target instanceof HTMLElement ? target.parentElement : null;
  if (!(target instanceof HTMLElement) || track === null) return;
  const rect = target.getBoundingClientRect();
  const mode = clip.resizable && rect.right - event.clientX <= 8 ? 'resize' : 'move';
  drag = { clip: { ...clip }, mode, x: event.clientX, width: track.getBoundingClientRect().width, moved: false };
  target.setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent): void {
  if (drag === null) return;
  const dx = event.clientX - drag.x;
  if (!drag.moved && Math.abs(dx) < 3) return;
  drag.moved = true;
  const dt = (dx / Math.max(drag.width, 1)) * duration.value;
  const { clip } = drag;
  const length = clip.end - clip.start;
  if (drag.mode === 'move') apply(clip, round1(Math.min(Math.max(clip.start + dt, 0), Math.max(duration.value - 0.5, 0))), round1(length));
  else apply(clip, clip.start, round1(Math.max(0.5, length + dt)));
}

function onPointerUp(event: PointerEvent, clip: Clip): void {
  const target = event.currentTarget;
  if (target instanceof HTMLElement && target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
  const moved = drag?.moved === true;
  drag = null;
  if (!moved) select(clip);
}

function onClipKey(event: KeyboardEvent, clip: Clip): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    select(clip);
    return;
  }
  if (!canEdit.value || clip.kind === 'transition') return;
  const step = event.shiftKey ? 0.1 : 0.5;
  const length = clip.end - clip.start;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    const delta = event.key === 'ArrowLeft' ? -step : step;
    if (event.altKey && clip.resizable) apply(clip, clip.start, round1(Math.max(0.5, length + delta)));
    else apply(clip, round1(Math.max(0, clip.start + delta)), round1(length));
    select(clip);
  }
}

// -- Adding audio -------------------------------------------------------------

function mediaDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const done = (value: number): void => {
      audio.src = '';
      resolve(value);
    };
    const timer = setTimeout(() => {
      done(4);
    }, 3000);
    audio.addEventListener('loadedmetadata', () => {
      clearTimeout(timer);
      done(Number.isFinite(audio.duration) && audio.duration > 0 ? Math.max(1, Math.round(audio.duration * 2) / 2) : 4);
    });
    audio.addEventListener('error', () => {
      clearTimeout(timer);
      done(4);
    });
    audio.preload = 'metadata';
    audio.src = url;
  });
}

async function addAudio(asset: MediaAsset): Promise<void> {
  libraryOpen.value = false;
  await session.addAudio(asset, await mediaDuration(asset.url));
  openProperties();
}

// -- Playback -----------------------------------------------------------------

const time = ref(0);
const playing = ref(false);
let frame = 0;
let startedAt = 0;
let sounds: HTMLAudioElement[] = [];
const started = new Set<string>();

function stopSounds(): void {
  for (const sound of sounds) sound.pause();
  sounds = [];
  started.clear();
}

function startSound(id: string, url: string, offset: number, rate: number, volume: number): void {
  if (started.has(id)) return;
  started.add(id);
  const sound = new Audio(url);
  sound.playbackRate = rate;
  sound.volume = volume;
  sound.currentTime = Math.max(0, offset);
  sounds.push(sound);
  sound.play().catch(() => {
    // The browser may block audio until the person interacts; the playhead keeps running.
  });
}

function tick(): void {
  const current = slide.value;
  time.value = (performance.now() - startedAt) / 1000;
  if (current !== null) {
    for (const clip of current.narrationClips) {
      if (clip.audioUrl !== null && clip.status === 'ready' && time.value >= clip.startsAtS && time.value < clip.startsAtS + narrationDuration(clip)) {
        startSound(clip.id, clip.audioUrl, (time.value - clip.startsAtS) * clip.speed, clip.speed, 1);
      }
    }
    for (const clip of current.audioClips) {
      if (clip.media !== null && time.value >= clip.startsAtS && time.value < clip.startsAtS + clip.durationS) startSound(clip.id, clip.media.url, time.value - clip.startsAtS, 1, clip.volume);
    }
  }
  if (time.value >= duration.value) {
    stop();
    time.value = 0;
    return;
  }
  frame = requestAnimationFrame(tick);
}

function play(): void {
  if (playing.value) {
    stop();
    return;
  }
  playing.value = true;
  startedAt = performance.now() - time.value * 1000;
  frame = requestAnimationFrame(tick);
}

function stop(): void {
  cancelAnimationFrame(frame);
  playing.value = false;
  stopSounds();
}

// -- Playhead -----------------------------------------------------------------

const ruler = ref<HTMLElement | null>(null);
const knob = ref<HTMLElement | null>(null);
let scrubbing = false;

/** Moves the playhead; while playing, the sounds start again from the new time. */
function seek(seconds: number): void {
  time.value = Math.max(0, Math.min(seconds, duration.value));
  if (playing.value) {
    stopSounds();
    startedAt = performance.now() - time.value * 1000;
  }
}

function seekToPointer(event: PointerEvent): void {
  const box = ruler.value?.getBoundingClientRect();
  if (box !== undefined) seek(timeAtOffset(event.clientX - box.left, box.width, duration.value));
}

/** Pressing the ruler moves the playhead there and dragging keeps moving it; playback pauses meanwhile. */
function onScrubStart(event: PointerEvent): void {
  if (event.button !== 0 || !(event.currentTarget instanceof HTMLElement)) return;
  // Without the default the press neither selects text nor takes the focus away from the slider.
  event.preventDefault();
  stop();
  scrubbing = true;
  event.currentTarget.setPointerCapture(event.pointerId);
  seekToPointer(event);
  knob.value?.focus();
}

function onScrubMove(event: PointerEvent): void {
  if (scrubbing) seekToPointer(event);
}

function onScrubEnd(event: PointerEvent): void {
  scrubbing = false;
  const target = event.currentTarget;
  if (target instanceof HTMLElement && target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
}

function onKnobKey(event: KeyboardEvent): void {
  const target = seekTarget(event.key, time.value, duration.value, event.shiftKey);
  if (target === null) return;
  event.preventDefault();
  seek(target);
}

watch(() => slide.value?.id, () => {
  stop();
  time.value = 0;
});
onBeforeUnmount(stop);
</script>

<template>
  <section class="timeline" :aria-label="`Línea de tiempo de la diapositiva ${position}`" data-testid="panel-timeline">
    <div class="head">
      <span class="lbl">Línea de tiempo</span>
      <span v-if="slide" class="pill"><b>Diapositiva {{ position }}</b><span class="muted">{{ typeName }}</span></span>
      <span class="spacer"></span>
      <button type="button" class="nav play" aria-label="Volver al inicio" title="Volver al inicio" :disabled="time === 0" data-testid="timeline-restart" @click="seek(0)">
        <StudioIcon name="skip-back" :size="12" />
      </button>
      <button type="button" class="nav play" :aria-label="playing ? 'Pausar' : `Reproducir la diapositiva ${position}`" :title="playing ? 'Pausar' : 'Reproducir'" data-testid="timeline-play" @click="play">
        <StudioIcon :name="playing ? 'pause' : 'play'" :size="12" />
      </button>
      <span class="clock" data-testid="timeline-time">{{ formatTime(time) }} / {{ formatTime(duration) }}</span>
    </div>
    <p v-if="!slide" class="empty">Elige una diapositiva para ver su línea de tiempo.</p>
    <div v-else class="scroll">
      <div class="inner">
        <div class="ruler">
          <span></span>
          <div
            ref="ruler"
            class="ticks"
            title="Haz clic o arrastra para mover la reproducción"
            data-testid="timeline-ruler"
            @pointerdown="onScrubStart"
            @pointermove="onScrubMove"
            @pointerup="onScrubEnd"
            @pointercancel="onScrubEnd"
          >
            <template v-for="mark in marks" :key="mark">
              <span class="tick" :style="{ left: percent(mark) }"></span>
              <span class="tick-label" :style="{ left: percent(mark) }">{{ formatTime(mark) }}</span>
            </template>
            <span
              ref="knob"
              class="knob"
              role="slider"
              tabindex="0"
              aria-label="Posición de la reproducción"
              :aria-valuemin="0"
              :aria-valuemax="duration"
              :aria-valuenow="Math.round(time * 10) / 10"
              :aria-valuetext="`${formatTime(time)} de ${formatTime(duration)}`"
              data-testid="timeline-playhead"
              :style="{ left: percent(time) }"
              @keydown="onKnobKey"
            ></span>
          </div>
        </div>

        <div v-for="row in topRows" :key="row.key" class="track-row" :data-testid="`timeline-row-${row.key}`">
            <div class="label-cell">
              <button type="button" class="tll" :aria-pressed="row.clips.some(selected)" :style="{ background: row.clips.some(selected) ? 'var(--s-sel)' : undefined }" @click="selectRow(row)">
                <span class="dot" :style="{ background: row.dot }"></span><span class="name">{{ row.name }}</span><span class="sub">{{ row.sub }}</span>
              </button>
            </div>
            <div class="track">
              <button v-for="clip in row.clips" :key="clip.id" type="button" class="tlc clip transition" :title="clip.title" :aria-pressed="selected(clip)" :style="{ ...clipStyle(clip), boxShadow: selected(clip) ? '0 0 0 2px var(--s-text)' : 'none' }" data-testid="timeline-clip-transition" @click="select(clip)"><span>{{ clip.label }}</span></button>
            </div>
        </div>

        <div class="section-row"><span class="lbl section">Componentes · {{ componentRows.length }}</span><span class="line"></span></div>
        <div v-for="row in componentRows" :key="row.key" class="track-row" :data-testid="`timeline-row-${row.key}`">
          <div class="label-cell">
            <button type="button" class="tll" :aria-pressed="row.clips.some(selected)" :style="{ background: row.clips.some(selected) ? 'var(--s-sel)' : undefined }" @click="selectRow(row)">
              <span class="dot" :style="{ background: row.dot }"></span><span class="name">{{ row.name }}</span><span class="sub">{{ row.sub }}</span>
            </button>
          </div>
          <div class="track">
            <button
              v-for="clip in row.clips"
              :key="clip.id"
              type="button"
              class="tlc clip element"
              :title="clip.title"
              :aria-pressed="selected(clip)"
              :aria-label="`${clip.title}. Flechas para moverlo.`"
              :style="{ ...clipStyle(clip), boxShadow: selected(clip) ? '0 0 0 2px var(--s-text)' : 'none' }"
              :data-testid="`timeline-clip-element-${clip.id}`"
              @pointerdown="onPointerDown($event, clip)"
              @pointermove="onPointerMove"
              @pointerup="onPointerUp($event, clip)"
              @keydown="onClipKey($event, clip)"
            ><span>{{ clip.label }}</span></button>
          </div>
        </div>

        <div role="group" aria-label="Audio y narración" class="audio-group">
          <div class="section-row"><span class="lbl section">Audio y narración</span><span class="line"></span></div>
          <div v-for="row in audioRows" :key="row.key" class="track-row" :data-testid="`timeline-row-${row.key}`">
            <div class="label-cell">
              <button type="button" class="tll" :aria-pressed="row.clips.some(selected)" :style="{ background: row.clips.some(selected) ? 'var(--s-sel)' : undefined }" @click="selectRow(row)">
                <span class="dot" :style="{ background: row.dot }"></span><span class="name">{{ row.name }}</span><span class="sub">{{ row.sub }}</span>
              </button>
              <button v-if="row.add && canEdit" type="button" class="ib add" :aria-label="row.addLabel" :title="row.addLabel" :data-testid="`timeline-add-${row.key}`" @click="row.add"><StudioIcon name="plus" :size="13" :stroke="2" /></button>
            </div>
            <div class="track">
              <button
                v-for="clip in row.clips"
                :key="clip.id"
                type="button"
                class="tlc clip"
                :class="[clip.kind, { resizable: clip.resizable }]"
                :title="clip.title"
                :aria-pressed="selected(clip)"
                :aria-label="`${clip.title}. Flechas para moverlo${clip.resizable ? '; Alt y flechas para cambiar la duración' : ''}.`"
                :style="{ ...clipStyle(clip), boxShadow: selected(clip) ? '0 0 0 2px var(--s-text)' : 'none' }"
                :data-testid="`timeline-clip-${clip.kind}-${clip.id}`"
                @pointerdown="onPointerDown($event, clip)"
                @pointermove="onPointerMove"
                @pointerup="onPointerUp($event, clip)"
                @keydown="onClipKey($event, clip)"
              ><span>{{ clip.label }}</span></button>
            </div>
          </div>
        </div>
        <span class="playhead" aria-hidden="true" :style="{ left: `calc(210px + (100% - 210px) * ${Math.min(time / duration, 1)})` }"></span>
      </div>
    </div>
    <MediaLibraryDialog v-if="libraryOpen" selectable mime-filter="audio/" @close="libraryOpen = false" @select="addAudio" />
  </section>
</template>

<style scoped>
.timeline { flex: 3 1 0; min-height: 220px; display: flex; flex-direction: column; background: var(--s-chrome); border-top: 1px solid var(--s-border); }
.head { flex: none; height: 32px; display: flex; align-items: center; gap: 10px; padding: 0 12px 0 14px; }
.pill { display: inline-flex; align-items: center; gap: 6px; padding: 2px 9px; border-radius: 999px; background: var(--s-hover); font-size: 12px; }
.pill b { font-weight: 600; }
.muted { color: var(--s-text-2); }
.spacer { flex: 1; }
.play { width: 26px; height: 26px; }
.clock { font-size: 12px; color: var(--s-text-2); font-variant-numeric: tabular-nums; }
.empty { margin: 16px 14px; font-size: 12px; color: var(--s-text-2); }
.scroll { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 0 12px; }
.inner { position: relative; min-width: 620px; }
.ruler { position: sticky; top: 0; z-index: 2; display: grid; grid-template-columns: 210px 1fr; height: 22px; background: var(--s-chrome); }
.ticks { position: relative; border-bottom: 1px solid var(--s-border); cursor: pointer; touch-action: none; user-select: none; }
.knob { position: absolute; top: 1px; width: 11px; height: 13px; margin-left: -5px; border-radius: 2px 2px 6px 6px; background: var(--s-danger); z-index: 4; cursor: ew-resize; }
.tick { position: absolute; bottom: 0; height: 6px; border-left: 1px solid var(--s-text-2); }
.tick-label { position: absolute; top: 2px; padding-left: 4px; font-size: 10px; color: var(--s-text-2); }
.track-row { display: grid; grid-template-columns: 210px 1fr; height: 25px; align-items: center; }
.label-cell { display: flex; align-items: center; gap: 2px; min-width: 0; margin-right: 8px; }
.tll { flex: 1; min-width: 0; }
.dot { width: 8px; height: 8px; flex: none; border-radius: 2px; }
.name { flex: none; }
.sub { min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--s-text-2); }
.add { width: 22px; height: 22px; flex: none; }
.track { position: relative; height: 20px; border-radius: 4px; background: var(--s-hover); }
.clip { touch-action: none; }
.clip.transition { background: var(--tl-trans-bg); border-color: var(--tl-trans); }
.clip.element { background: var(--tl-el-bg); border-color: var(--tl-el); cursor: grab; }
.clip.narration { background: var(--tl-narr-bg); border-color: var(--tl-narr); cursor: grab; }
.clip.audio { background: var(--tl-audio-bg); border-color: var(--tl-audio); cursor: grab; }
.clip.pause { background: var(--tl-pause-bg); border-color: var(--tl-pause); cursor: grab; }
.clip.resizable::after { content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 6px; cursor: ew-resize; }
.section-row { display: grid; grid-template-columns: 210px 1fr; height: 24px; align-items: center; }
.section { padding-left: 8px; font-size: 10px; }
.line { height: 1px; background: var(--s-border); }
.audio-group { position: sticky; bottom: 0; z-index: 2; padding-bottom: 8px; background: var(--s-chrome); box-shadow: 0 -1px 0 var(--s-border); }
.playhead { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--s-danger); z-index: 3; pointer-events: none; }
</style>
