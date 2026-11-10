import type { ThemeColorKey } from '@lumia/packages/catalog';
import { ADVANCE_MODES, THEME_COLOR_KEYS } from '@lumia/packages/catalog';
import type {
  AdvanceMode,
  AudioClip,
  AudioKind,
  CatalogComponentInfo,
  CatalogInfo,
  Category,
  ClassDocument,
  DocumentStatus,
  DocumentVersion,
  Entrance,
  MediaRef,
  NarrationClip,
  NarrationStatus,
  Pause,
  PauseEnd,
  Slide,
  SlideComment,
  SlideElement,
  Subcategory,
  Transition,
  TreeNode,
  TreeNodeKind,
  VersionStatus,
} from './types.ts';

export type Json = Record<string, unknown>;

export function rec(value: unknown): Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? { ...value } : {};
}

export function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value.map((item: unknown) => item) : [];
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.find((item) => item === value) ?? fallback;
}

/** `AWSJSON` travels as text; an unparseable value becomes an empty object. */
export function parseJson(value: unknown): Json {
  if (typeof value !== 'string') return rec(value);
  try {
    return rec(JSON.parse(value));
  } catch {
    return {};
  }
}

function decodeMedia(value: unknown): MediaRef | null {
  if (typeof value !== 'object' || value === null) return null;
  const media = rec(value);
  return { id: str(media.id), name: str(media.name), mimeType: str(media.mimeType), url: str(media.url) };
}

export function decodeElement(value: unknown): SlideElement {
  const element = rec(value);
  return {
    id: str(element.id),
    slideId: str(element.slideId),
    component: str(element.component),
    name: str(element.name),
    x: num(element.x),
    y: num(element.y),
    w: num(element.w),
    h: num(element.h),
    z: num(element.z),
    appearsAtS: num(element.appearsAtS),
    entrance: oneOf<Entrance>(element.entrance, ['none', 'appear', 'fade', 'slide', 'draw'], 'none'),
    props: parseJson(element.props),
    mediaId: typeof element.mediaId === 'string' ? element.mediaId : null,
    media: decodeMedia(element.media),
  };
}

const NARRATION_STATUSES: readonly NarrationStatus[] = ['pending', 'generating', 'ready', 'failed'];
const AUDIO_KINDS: readonly AudioKind[] = ['music', 'effect'];
const PAUSE_ENDS: readonly PauseEnd[] = ['continue', 'wait_click'];

export function decodeNarrationClip(value: unknown): NarrationClip {
  const clip = rec(value);
  return {
    id: str(clip.id),
    slideId: str(clip.slideId),
    startsAtS: num(clip.startsAtS),
    script: str(clip.script),
    voice: typeof clip.voice === 'string' && clip.voice !== '' ? clip.voice : null,
    speed: num(clip.speed, 1),
    generatedDurationS: typeof clip.generatedDurationS === 'number' ? clip.generatedDurationS : null,
    audioUrl: typeof clip.audioUrl === 'string' ? clip.audioUrl : null,
    status: oneOf<NarrationStatus>(clip.status, NARRATION_STATUSES, 'pending'),
    errorMessage: typeof clip.errorMessage === 'string' ? clip.errorMessage : null,
  };
}

export function decodePause(value: unknown): Pause {
  const pause = rec(value);
  return {
    id: str(pause.id),
    slideId: str(pause.slideId),
    startsAtS: num(pause.startsAtS),
    durationS: num(pause.durationS, 5),
    message: str(pause.message),
    onEnd: oneOf<PauseEnd>(pause.onEnd, PAUSE_ENDS, 'continue'),
    timerElementId: typeof pause.timerElementId === 'string' ? pause.timerElementId : null,
  };
}

export function decodeAudioClip(value: unknown): AudioClip {
  const clip = rec(value);
  return {
    id: str(clip.id),
    slideId: str(clip.slideId),
    mediaId: typeof clip.mediaId === 'string' ? clip.mediaId : null,
    media: decodeMedia(clip.media),
    startsAtS: num(clip.startsAtS),
    durationS: num(clip.durationS),
    name: str(clip.name),
    kind: oneOf<AudioKind>(clip.kind, AUDIO_KINDS, 'music'),
    volume: num(clip.volume, 1),
  };
}

export function decodeComment(value: unknown): SlideComment {
  const comment = rec(value);
  return {
    id: str(comment.id),
    slideId: str(comment.slideId),
    authorSub: str(comment.authorSub),
    authorName: str(comment.authorName),
    body: str(comment.body),
    createdAt: str(comment.createdAt),
  };
}

export function decodeSlide(value: unknown): Slide {
  const slide = rec(value);
  return {
    id: str(slide.id),
    versionId: str(slide.versionId),
    position: num(slide.position),
    title: str(slide.title),
    background: oneOf<ThemeColorKey>(slide.background, THEME_COLOR_KEYS, 'surface'),
    durationS: num(slide.durationS),
    transition: oneOf<Transition>(slide.transition, ['none', 'fade', 'slide', 'zoom'], 'none'),
    advance: oneOf<AdvanceMode>(slide.advance, ADVANCE_MODES, 'click'),
    elements: list(slide.elements).map(decodeElement).sort((a, b) => a.z - b.z),
    narrationClips: list(slide.narrationClips).map(decodeNarrationClip),
    pauses: list(slide.pauses).map(decodePause),
    audioClips: list(slide.audioClips).map(decodeAudioClip),
    comments: list(slide.comments).map(decodeComment),
  };
}

export function decodeVersion(value: unknown): DocumentVersion {
  const version = rec(value);
  return {
    id: str(version.id),
    documentId: str(version.documentId),
    number: num(version.number),
    status: oneOf<VersionStatus>(version.status, ['draft', 'published', 'archived'], 'draft'),
    slides: list(version.slides).map(decodeSlide).sort((a, b) => a.position - b.position),
  };
}

export function decodeDocument(value: unknown): ClassDocument {
  const document = rec(value);
  return {
    id: str(document.id),
    nodeId: str(document.nodeId),
    status: oneOf<DocumentStatus>(document.status, ['no_content', 'draft', 'published'], 'no_content'),
    currentVersion: num(document.currentVersion),
    publishedVersion: typeof document.publishedVersion === 'number' ? document.publishedVersion : null,
    versions: list(document.versions).map((item) => {
      const summary = rec(item);
      return {
        id: str(summary.id),
        number: num(summary.number),
        status: oneOf<VersionStatus>(summary.status, ['draft', 'published', 'archived'], 'draft'),
      };
    }),
    editingVersion: decodeVersion(document.editingVersion),
  };
}

export function decodeSubcategory(value: unknown): Subcategory {
  const subcategory = rec(value);
  return {
    id: str(subcategory.id),
    categoryId: str(subcategory.categoryId),
    name: str(subcategory.name),
    displayName: str(subcategory.displayName),
    description: str(subcategory.description),
    groupName: typeof subcategory.groupName === 'string' && subcategory.groupName !== '' ? subcategory.groupName : null,
  };
}

export function decodeCategory(value: unknown): Category {
  const category = rec(value);
  return {
    id: str(category.id),
    name: str(category.name),
    displayName: str(category.displayName),
    description: str(category.description),
    groupName: typeof category.groupName === 'string' && category.groupName !== '' ? category.groupName : null,
    subcategories: list(category.subcategories).map(decodeSubcategory),
  };
}

const DOCUMENT_STATUSES: readonly DocumentStatus[] = ['no_content', 'draft', 'published'];

export function decodeTreeNode(value: unknown): TreeNode {
  const node = rec(value);
  const kind: TreeNodeKind = node.kind === 'folder' ? 'folder' : 'class';
  const status = DOCUMENT_STATUSES.find((candidate) => candidate === node.documentStatus) ?? null;
  return {
    id: str(node.id),
    subcategoryId: str(node.subcategoryId),
    parentId: typeof node.parentId === 'string' && node.parentId !== '' ? node.parentId : null,
    kind,
    name: str(node.name),
    displayName: str(node.displayName),
    description: str(node.description),
    position: num(node.position),
    documentId: typeof node.documentId === 'string' ? node.documentId : null,
    documentStatus: kind === 'class' ? (status ?? 'no_content') : null,
    currentVersion: typeof node.currentVersion === 'number' ? node.currentVersion : null,
    publishedVersion: typeof node.publishedVersion === 'number' ? node.publishedVersion : null,
  };
}

export function decodeCatalog(value: unknown): CatalogInfo {
  const catalog = rec(value);
  return {
    components: list(catalog.components).map((item): CatalogComponentInfo => {
      const component = rec(item);
      const size = rec(component.defaultSize);
      return {
        key: str(component.key),
        name: str(component.name),
        group: str(component.group),
        groupName: str(component.groupName),
        usage: str(component.usage),
        propsSchema: parseJson(component.propsSchema),
        defaults: parseJson(component.defaults),
        defaultSize: { w: num(size.w), h: num(size.h) },
        usesMedia: component.usesMedia === true,
        isQuestion: component.isQuestion === true,
      };
    }),
  };
}
