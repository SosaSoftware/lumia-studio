import type { AdvanceMode, AudioKind, Entrance, PauseEnd, Slide, SlideElement, Transition } from '../../api/types.ts';
import type { SlideTypeKey, ThemeColorKey } from '@lumia/packages/catalog';
import type { IdHandles } from './id-handles.ts';

/** Copy of a value that holds only JSON data. */
export function cloneValue<T>(value: T): T {
  // A JSON round trip: the values come from reactive proxies, which `structuredClone` cannot copy.
  return JSON.parse(JSON.stringify(value)) as T;
}

/** The values the fields named in `patch` have in `source` now: the patch that undoes `patch`. */
export function valuesBefore<P extends object>(source: object, patch: P): P {
  const current: Record<string, unknown> = { ...source };
  const before: Record<string, unknown> = {};
  for (const key of Object.keys(patch)) {
    const value = current[key];
    before[key] = value === undefined ? undefined : cloneValue(value);
  }
  // The keys are the ones of the patch, so the copy has the shape of a patch.
  return before as P;
}

/** Everything that defines an element and can be given back to it. */
export interface ElementData {
  readonly component: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly z: number;
  readonly appearsAtS: number;
  readonly entrance: Entrance;
  readonly props: Record<string, unknown>;
}

export interface ElementSnapshot extends ElementData {
  /** Name of the element in the history. */
  readonly handle: string;
  readonly slideHandle: string;
}

export interface PauseFields {
  readonly startsAtS: number;
  readonly durationS: number;
  readonly message: string;
  readonly onEnd: PauseEnd;
}

export interface AudioFields {
  readonly mediaId: string;
  readonly startsAtS: number;
  readonly durationS: number;
  readonly name: string;
  /** Music or effect; it is not called `kind` because that is how a clip says which sort of clip it is. */
  readonly audioKind: AudioKind;
  readonly volume: number;
}

export interface NarrationFields {
  readonly script: string;
  readonly startsAtS: number;
  readonly voice: string | null;
  readonly speed: number;
}

export type ClipKind = 'pause' | 'audio' | 'narration';

/** A clip as `restoreClip` receives it. */
export type ClipData =
  | ({ readonly kind: 'pause'; readonly timerElementId: string | null } & PauseFields)
  | ({ readonly kind: 'audio' } & AudioFields)
  | ({ readonly kind: 'narration' } & NarrationFields);

/** A clip as the history keeps it: with names, so it can be found again whatever its id is. */
export type ClipSnapshot = (
  | ({ readonly kind: 'pause'; readonly timerHandle: string | null } & PauseFields)
  | ({ readonly kind: 'audio' } & AudioFields)
  | ({ readonly kind: 'narration' } & NarrationFields)
) & { readonly handle: string; readonly slideHandle: string };

/** A slide and what it holds, as `restoreSlide` receives it. */
export interface SlideData {
  readonly type: SlideTypeKey;
  readonly title: string;
  readonly background: ThemeColorKey;
  readonly durationS: number;
  readonly transition: Transition;
  readonly advance: AdvanceMode;
  readonly elements: readonly ElementData[];
  /** `timerIndex` is the place in `elements` of the timer element a pause waits for. */
  readonly pauses: readonly (PauseFields & { readonly timerIndex: number | null })[];
  readonly audio: readonly AudioFields[];
  readonly narration: readonly NarrationFields[];
}

export interface SlideSnapshot extends SlideData {
  readonly handle: string;
  readonly elementHandles: readonly string[];
  readonly pauseHandles: readonly string[];
  readonly audioHandles: readonly string[];
  readonly narrationHandles: readonly string[];
}

/** The ids of what `restoreSlide` created, in the order of the data it received. */
export interface RestoredSlide {
  readonly slideId: string;
  readonly elementIds: readonly string[];
  readonly pauseIds: readonly string[];
  readonly audioIds: readonly string[];
  readonly narrationIds: readonly string[];
}

export function elementData(element: SlideElement): ElementData {
  return {
    component: element.component,
    name: element.name,
    x: element.x,
    y: element.y,
    w: element.w,
    h: element.h,
    z: element.z,
    appearsAtS: element.appearsAtS,
    entrance: element.entrance,
    props: cloneValue(element.props),
  };
}

export function snapshotElement(handles: IdHandles, element: SlideElement): ElementSnapshot {
  return { ...elementData(element), handle: handles.handle(element.id), slideHandle: handles.handle(element.slideId) };
}

export function snapshotSlide(handles: IdHandles, slide: Slide): SlideSnapshot {
  const audio = slide.audioClips.filter((clip) => clip.mediaId !== null);
  return {
    handle: handles.handle(slide.id),
    type: slide.type,
    title: slide.title,
    background: slide.background,
    durationS: slide.durationS,
    transition: slide.transition,
    advance: slide.advance,
    elements: slide.elements.map(elementData),
    elementHandles: slide.elements.map((element) => handles.handle(element.id)),
    pauses: slide.pauses.map((pause) => {
      const timerIndex = slide.elements.findIndex((element) => element.id === pause.timerElementId);
      return { startsAtS: pause.startsAtS, durationS: pause.durationS, message: pause.message, onEnd: pause.onEnd, timerIndex: timerIndex < 0 ? null : timerIndex };
    }),
    pauseHandles: slide.pauses.map((pause) => handles.handle(pause.id)),
    audio: audio.map((clip) => ({ mediaId: clip.mediaId ?? '', startsAtS: clip.startsAtS, durationS: clip.durationS, name: clip.name, audioKind: clip.kind, volume: clip.volume })),
    audioHandles: audio.map((clip) => handles.handle(clip.id)),
    narration: slide.narrationClips.map((clip) => ({ script: clip.script, startsAtS: clip.startsAtS, voice: clip.voice, speed: clip.speed })),
    narrationHandles: slide.narrationClips.map((clip) => handles.handle(clip.id)),
  };
}

/**
 * Ids of the created elements that correspond to the wanted ones, in the order of the wanted ones. An element is
 * matched by what it is and where it sits; when that is ambiguous the order breaks the tie.
 */
export function pairElements(wanted: readonly ElementData[], created: readonly SlideElement[]): string[] {
  const used = new Set<string>();
  return wanted.map((item, index) => {
    const same = created.find((candidate) => !used.has(candidate.id) && candidate.component === item.component && candidate.x === item.x && candidate.y === item.y && candidate.z === item.z);
    const found = same ?? created[index];
    if (found !== undefined) used.add(found.id);
    return found?.id ?? '';
  });
}
