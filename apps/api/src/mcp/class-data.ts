import { json, list, num, optionalNum, optionalText, record, text } from './decode.ts';

/** GraphQL selections of the class content; signed URLs are left out because the model cannot use them. */
const MEDIA_FIELDS = 'id name mimeType';
export const ELEMENT_FIELDS = `id slideId component name x y w h z appearsAtS entrance props mediaId media { ${MEDIA_FIELDS} }`;
export const NARRATION_FIELDS = 'id slideId startsAtS script voice speed generatedDurationS status errorMessage';
export const PAUSE_FIELDS = 'id slideId startsAtS durationS message onEnd timerElementId';
export const AUDIO_FIELDS = `id slideId mediaId media { ${MEDIA_FIELDS} } startsAtS durationS name kind volume`;
const COMMENT_FIELDS = 'id authorName body createdAt';
export const SLIDE_FIELDS = `id versionId position type title background durationS transition advance
  elements { ${ELEMENT_FIELDS} } narrationClips { ${NARRATION_FIELDS} } pauses { ${PAUSE_FIELDS} }
  audioClips { ${AUDIO_FIELDS} } comments { ${COMMENT_FIELDS} }`;
export const VERSION_FIELDS = `id documentId number status slides { ${SLIDE_FIELDS} }`;
export const DOCUMENT_FIELDS = `id nodeId status currentVersion publishedVersion editingVersion { ${VERSION_FIELDS} }`;

export interface MediaData {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
}

export interface ElementData {
  readonly id: string;
  readonly slideId: string;
  readonly component: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly z: number;
  readonly appearsAtS: number;
  readonly entrance: string;
  readonly props: Record<string, unknown>;
  readonly media: MediaData | null;
}

export interface NarrationData {
  readonly id: string;
  readonly slideId: string;
  readonly startsAtS: number;
  readonly script: string;
  readonly voice: string | null;
  readonly speed: number;
  readonly generatedDurationS: number;
  readonly status: string;
  readonly errorMessage: string | null;
}

export interface PauseData {
  readonly id: string;
  readonly slideId: string;
  readonly startsAtS: number;
  readonly durationS: number;
  readonly message: string;
  readonly onEnd: string;
  readonly timerElementId: string | null;
}

export interface AudioData {
  readonly id: string;
  readonly slideId: string;
  readonly mediaId: string;
  readonly media: MediaData | null;
  readonly startsAtS: number;
  readonly durationS: number;
  readonly name: string;
  readonly kind: string;
  readonly volume: number;
}

export interface CommentData {
  readonly id: string;
  readonly authorName: string;
  readonly body: string;
  readonly createdAt: string;
}

export interface SlideData {
  readonly id: string;
  readonly versionId: string;
  readonly position: number;
  readonly type: string;
  readonly title: string;
  readonly background: string;
  readonly durationS: number;
  readonly transition: string;
  readonly advance: string;
  readonly elements: readonly ElementData[];
  readonly narrationClips: readonly NarrationData[];
  readonly pauses: readonly PauseData[];
  readonly audioClips: readonly AudioData[];
  readonly comments: readonly CommentData[];
}

export interface VersionData {
  readonly id: string;
  readonly documentId: string;
  readonly number: number;
  readonly status: string;
  readonly slides: readonly SlideData[];
}

export interface DocumentData {
  readonly id: string;
  readonly nodeId: string;
  readonly status: string;
  readonly currentVersion: number;
  readonly publishedVersion: number | null;
  readonly editingVersion: VersionData;
}

function decodeMedia(value: unknown): MediaData | null {
  const media = record(value);
  return typeof media.id === 'string' ? { id: media.id, name: text(media.name), mimeType: text(media.mimeType) } : null;
}

export function decodeElement(value: unknown): ElementData {
  const element = record(value);
  return {
    id: text(element.id),
    slideId: text(element.slideId),
    component: text(element.component),
    name: text(element.name),
    x: num(element.x),
    y: num(element.y),
    w: num(element.w),
    h: num(element.h),
    z: num(element.z),
    appearsAtS: num(element.appearsAtS),
    entrance: text(element.entrance, 'none'),
    props: record(json(element.props)),
    media: decodeMedia(element.media),
  };
}

export function decodeNarration(value: unknown): NarrationData {
  const clip = record(value);
  return {
    id: text(clip.id),
    slideId: text(clip.slideId),
    startsAtS: num(clip.startsAtS),
    script: text(clip.script),
    voice: optionalText(clip.voice),
    speed: num(clip.speed, 1),
    generatedDurationS: num(clip.generatedDurationS),
    status: text(clip.status),
    errorMessage: optionalText(clip.errorMessage),
  };
}

export function decodePause(value: unknown): PauseData {
  const pause = record(value);
  return {
    id: text(pause.id),
    slideId: text(pause.slideId),
    startsAtS: num(pause.startsAtS),
    durationS: num(pause.durationS),
    message: text(pause.message),
    onEnd: text(pause.onEnd, 'continue'),
    timerElementId: optionalText(pause.timerElementId),
  };
}

export function decodeAudio(value: unknown): AudioData {
  const clip = record(value);
  return {
    id: text(clip.id),
    slideId: text(clip.slideId),
    mediaId: text(clip.mediaId),
    media: decodeMedia(clip.media),
    startsAtS: num(clip.startsAtS),
    durationS: num(clip.durationS),
    name: text(clip.name),
    kind: text(clip.kind, 'music'),
    volume: num(clip.volume, 1),
  };
}

function decodeComment(value: unknown): CommentData {
  const comment = record(value);
  return { id: text(comment.id), authorName: text(comment.authorName), body: text(comment.body), createdAt: text(comment.createdAt) };
}

export function decodeSlide(value: unknown): SlideData {
  const slide = record(value);
  return {
    id: text(slide.id),
    versionId: text(slide.versionId),
    position: num(slide.position),
    type: text(slide.type),
    title: text(slide.title),
    background: text(slide.background),
    durationS: num(slide.durationS),
    transition: text(slide.transition, 'none'),
    advance: text(slide.advance, 'click'),
    elements: list(slide.elements).map(decodeElement),
    narrationClips: list(slide.narrationClips).map(decodeNarration),
    pauses: list(slide.pauses).map(decodePause),
    audioClips: list(slide.audioClips).map(decodeAudio),
    comments: list(slide.comments).map(decodeComment),
  };
}

export function decodeVersion(value: unknown): VersionData {
  const version = record(value);
  return {
    id: text(version.id),
    documentId: text(version.documentId),
    number: num(version.number),
    status: text(version.status),
    slides: list(version.slides)
      .map(decodeSlide)
      .sort((a, b) => a.position - b.position),
  };
}

export function decodeDocument(value: unknown): DocumentData | null {
  const document = record(value);
  if (typeof document.id !== 'string') return null;
  return {
    id: document.id,
    nodeId: text(document.nodeId),
    status: text(document.status),
    currentVersion: num(document.currentVersion),
    publishedVersion: optionalNum(document.publishedVersion),
    editingVersion: decodeVersion(document.editingVersion),
  };
}

// -- Views returned to the model ---------------------------------------------------------------

export interface SlideSummary {
  readonly id: string;
  readonly position: number;
  readonly type: string;
  readonly title: string;
  readonly durationS: number;
  readonly transition: string;
  readonly advance: string;
  readonly components: readonly string[];
  readonly narrationClips: number;
  readonly audioClips: number;
  readonly pauses: number;
  readonly comments: number;
}

export function slideSummary(slide: SlideData): SlideSummary {
  return {
    id: slide.id,
    position: slide.position,
    type: slide.type,
    title: slide.title,
    durationS: slide.durationS,
    transition: slide.transition,
    advance: slide.advance,
    components: slide.elements.map((element) => element.component),
    narrationClips: slide.narrationClips.length,
    audioClips: slide.audioClips.length,
    pauses: slide.pauses.length,
    comments: slide.comments.length,
  };
}

export type ElementView = Omit<ElementData, 'slideId'>;

export function elementView(element: ElementData): ElementView {
  return {
    id: element.id,
    component: element.component,
    name: element.name,
    x: element.x,
    y: element.y,
    w: element.w,
    h: element.h,
    z: element.z,
    appearsAtS: element.appearsAtS,
    entrance: element.entrance,
    props: element.props,
    media: element.media,
  };
}

export interface SlideView extends Omit<SlideData, 'versionId' | 'elements'> {
  readonly elements: readonly ElementView[];
}

export function slideView(slide: SlideData): SlideView {
  return {
    id: slide.id,
    position: slide.position,
    type: slide.type,
    title: slide.title,
    background: slide.background,
    durationS: slide.durationS,
    transition: slide.transition,
    advance: slide.advance,
    elements: slide.elements.map(elementView),
    narrationClips: slide.narrationClips,
    pauses: slide.pauses,
    audioClips: slide.audioClips,
    comments: slide.comments,
  };
}
