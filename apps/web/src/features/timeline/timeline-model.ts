import type { AdvanceMode, AudioKind, Entrance, NarrationClip, NarrationStatus, PauseEnd, Slide, SlideElement, Transition } from '../../api/types.ts';

export const MAX_SCRIPT_LENGTH = 3000;
export const MIN_SPEED = 0.1;
export const MAX_SPEED = 2;

export const ENTRANCE_LABELS: Readonly<Record<Entrance, string>> = { none: 'Ninguna', appear: 'Aparecer', fade: 'Desvanecer', slide: 'Deslizar', draw: 'Dibujar' };
export const TRANSITION_LABELS: Readonly<Record<Transition, string>> = { none: 'Ninguna', fade: 'Desvanecer', slide: 'Deslizar', zoom: 'Zoom' };
export const ADVANCE_LABELS: Readonly<Record<AdvanceMode, string>> = { auto: 'Automático', click: 'Con clic', on_complete: 'Al completar' };
export const AUDIO_KIND_LABELS: Readonly<Record<AudioKind, string>> = { music: 'Música', effect: 'Efecto' };
export const PAUSE_END_LABELS: Readonly<Record<PauseEnd, string>> = { continue: 'Continuar', wait_click: 'Esperar clic' };
export const NARRATION_STATUS_LABELS: Readonly<Record<NarrationStatus, string>> = {
  pending: 'Sin voz',
  generating: 'Generando…',
  ready: 'Voz lista',
  failed: 'No se generó',
};


/** `m:ss`, as the design writes times. */
export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(total / 60))}:${String(total % 60).padStart(2, '0')}`;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Seconds a clip lasts on screen: the generated duration divided by the speed (the voice is not generated again
 * for a new speed). Before the voice exists, an estimate from the script length.
 */
export function narrationDuration(clip: Pick<NarrationClip, 'generatedDurationS' | 'speed' | 'script'>): number {
  const speed = clip.speed > 0 ? clip.speed : 1;
  const generated = clip.generatedDurationS ?? 0;
  const base = generated > 0 ? generated : Math.max(3, Math.ceil(clip.script.trim().length / 14));
  return round1(base / speed);
}

/** The slide lasts at least until its narration ends, plus one second. */
/** Seconds that a timer element counts down, or null when the element is not a timer. */
export function timerSeconds(element: Pick<SlideElement, 'component' | 'props'>): number | null {
  if (element.component !== 'timer') return null;
  const seconds = element.props.seconds;
  return typeof seconds === 'number' && seconds > 0 ? seconds : null;
}

/** End of the countdown of a timer that starts by itself when it appears; null for any other element. */
export function autoTimerEnd(element: Pick<SlideElement, 'component' | 'props' | 'appearsAtS'>): number | null {
  const seconds = timerSeconds(element);
  return seconds === null || element.props.autoStart !== true ? null : element.appearsAtS + seconds;
}

/**
 * Time the slide lasts: its duration, extended until its narration and the timers that start by themselves end.
 * A timer that the student starts has no known end, so it does not extend the slide.
 */
export function slideDuration(slide: Pick<Slide, 'durationS' | 'narrationClips'> & Partial<Pick<Slide, 'elements'>>): number {
  let duration = slide.durationS > 0 ? slide.durationS : 20;
  for (const clip of slide.narrationClips) duration = Math.max(duration, Math.ceil(clip.startsAtS + narrationDuration(clip) + 1));
  for (const element of slide.elements ?? []) {
    const end = autoTimerEnd(element);
    if (end !== null) duration = Math.max(duration, Math.ceil(end));
  }
  return duration;
}

/** Bar of an element on the timeline: from when it appears to the end of the slide; a timer, while it counts down. */
export function elementSpan(element: Pick<SlideElement, 'component' | 'props' | 'appearsAtS'>, slideDurationS: number): { start: number; end: number } {
  const seconds = timerSeconds(element);
  const end = seconds === null ? slideDurationS : Math.min(slideDurationS, element.appearsAtS + seconds);
  return { start: element.appearsAtS, end: Math.max(end, element.appearsAtS) };
}

/** Spacing of the ruler marks for a slide of `duration` seconds. */
export function tickStep(duration: number): number {
  if (duration <= 20) return 2;
  if (duration <= 60) return 5;
  if (duration <= 180) return 15;
  return 30;
}

/** Ruler marks from 0 up to (not including) the end. */
export function ticks(duration: number): number[] {
  const step = tickStep(duration);
  const marks: number[] = [];
  for (let time = 0; time < duration - step / 3; time += step) marks.push(time);
  return marks;
}

/** Start of a new clip appended to a track: one second after the last one ends, as in the design. */
export function nextStart(clips: readonly { startsAtS: number; durationS: number }[]): number {
  const last = clips.reduce<{ startsAtS: number; durationS: number } | null>((latest, clip) => (latest === null || clip.startsAtS >= latest.startsAtS ? clip : latest), null);
  return last === null ? 1 : round1(last.startsAtS + last.durationS + 1);
}

/** Maps the speed slider (0–100, with 1x in the middle) to a speed and back, as in the design. */
export function speedFromSlider(position: number): number {
  const x = Math.min(Math.max(position, 0), 100);
  const speed = x <= 50 ? MIN_SPEED + ((1 - MIN_SPEED) * x) / 50 : 1 + ((MAX_SPEED - 1) * (x - 50)) / 50;
  return Math.round(speed * 100) / 100;
}

export function sliderFromSpeed(speed: number): number {
  const s = Math.min(Math.max(speed, MIN_SPEED), MAX_SPEED);
  return Math.round(s <= 1 ? ((s - MIN_SPEED) / (1 - MIN_SPEED)) * 50 : 50 + ((s - 1) / (MAX_SPEED - 1)) * 50);
}

export function formatSpeed(speed: number): string {
  return `${String(Math.round(speed * 10) / 10)}x`;
}

/** Seconds under a point of the ruler, inside the slide. */
export function timeAtOffset(offsetPx: number, widthPx: number, durationS: number): number {
  if (widthPx <= 0) return 0;
  return Math.max(0, Math.min(durationS, (offsetPx / widthPx) * durationS));
}

/** Where a key moves the playhead (arrows by half a second, five with Shift; Home and End); null for other keys. */
export function seekTarget(key: string, timeS: number, durationS: number, long = false): number | null {
  const step = long ? 5 : 0.5;
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      return Math.max(0, timeS - step);
    case 'ArrowRight':
    case 'ArrowUp':
      return Math.min(durationS, timeS + step);
    case 'Home':
      return 0;
    case 'End':
      return durationS;
    default:
      return null;
  }
}
