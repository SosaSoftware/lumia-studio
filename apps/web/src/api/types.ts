import type { AdvanceMode, ThemeColorKey } from '@lumia/packages/catalog';

export type DocumentStatus = 'no_content' | 'draft' | 'published';
export type VersionStatus = 'draft' | 'published' | 'archived';
export type Transition = 'none' | 'fade' | 'slide' | 'zoom';
export type { AdvanceMode } from '@lumia/packages/catalog';
export type Entrance = 'none' | 'appear' | 'fade' | 'slide' | 'draw';

export const TRANSITIONS: readonly Transition[] = ['none', 'fade', 'slide', 'zoom'];
/** Advance modes in the order Properties offers them. */
export const ADVANCE_MODES: readonly AdvanceMode[] = ['auto', 'click', 'on_complete'];
export const ENTRANCES: readonly Entrance[] = ['none', 'appear', 'fade', 'slide', 'draw'];

export interface Subcategory {
  id: string;
  categoryId: string;
  /** Logical name: lowercase letters, digits and hyphens. */
  name: string;
  displayName: string;
  description: string;
  /** Heading that groups it in the menus; null when it has none. */
  groupName: string | null;
}

/** A category the person can see, with the subcategories they can open. */
export interface Category {
  id: string;
  name: string;
  displayName: string;
  description: string;
  /** Heading that groups it in the menus; null when it has none. */
  groupName: string | null;
  subcategories: Subcategory[];
}

export type TreeNodeKind = 'folder' | 'class';

/** A folder or a class of the tree of a subcategory; the document fields are null for folders. */
export interface TreeNode {
  id: string;
  subcategoryId: string;
  parentId: string | null;
  kind: TreeNodeKind;
  /** Logical name, unique in its folder; classes end in `.lumia`. */
  name: string;
  displayName: string;
  description: string;
  position: number;
  documentId: string | null;
  documentStatus: DocumentStatus | null;
  currentVersion: number | null;
  publishedVersion: number | null;
}

export interface MediaRef {
  id: string;
  name: string;
  mimeType: string;
  url: string;
}

export interface SlideElement {
  id: string;
  slideId: string;
  component: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  appearsAtS: number;
  entrance: Entrance;
  props: Record<string, unknown>;
  mediaId: string | null;
  media: MediaRef | null;
}

export type NarrationStatus = 'pending' | 'generating' | 'ready' | 'failed';
export type AudioKind = 'music' | 'effect';
export type PauseEnd = 'continue' | 'wait_click';

export interface NarrationClip {
  id: string;
  slideId: string;
  startsAtS: number;
  script: string;
  /** Polly voice id; null until the person picks one. */
  voice: string | null;
  speed: number;
  generatedDurationS: number | null;
  audioUrl: string | null;
  status: NarrationStatus;
  errorMessage: string | null;
}

export interface Pause {
  id: string;
  slideId: string;
  startsAtS: number;
  durationS: number;
  message: string;
  onEnd: PauseEnd;
  timerElementId: string | null;
}

export interface AudioClip {
  id: string;
  slideId: string;
  mediaId: string | null;
  media: MediaRef | null;
  startsAtS: number;
  durationS: number;
  name: string;
  kind: AudioKind;
  volume: number;
}

export interface SlideComment {
  id: string;
  slideId: string;
  authorSub: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface Slide {
  id: string;
  versionId: string;
  position: number;
  title: string;
  background: ThemeColorKey;
  durationS: number;
  transition: Transition;
  advance: AdvanceMode;
  elements: SlideElement[];
  narrationClips: NarrationClip[];
  pauses: Pause[];
  audioClips: AudioClip[];
  comments: SlideComment[];
}

export interface VersionSummary {
  id: string;
  number: number;
  status: VersionStatus;
}

export interface DocumentVersion extends VersionSummary {
  documentId: string;
  slides: Slide[];
}

export interface ClassDocument {
  id: string;
  /** Class node of the tree that holds the document. */
  nodeId: string;
  status: DocumentStatus;
  currentVersion: number;
  publishedVersion: number | null;
  versions: VersionSummary[];
  editingVersion: DocumentVersion;
}

/** Geometry and text a person edits on an element; sent to `saveElement`. */
export interface ElementPatch {
  name?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  z?: number;
  appearsAtS?: number;
  entrance?: Entrance;
  props?: Record<string, unknown>;
}

export interface SlidePatch {
  title?: string;
  background?: ThemeColorKey;
  durationS?: number;
  transition?: Transition;
  advance?: AdvanceMode;
}

export interface DraftElementInput {
  component: string;
  name?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  appearsAtS: number;
  entrance?: Entrance;
  props: Record<string, unknown>;
}

export interface DraftSlideInput {
  title: string;
  background?: ThemeColorKey;
  durationS?: number;
  transition?: Transition;
  advance?: AdvanceMode;
  elements: DraftElementInput[];
}

export interface MediaUpload {
  key: string;
  uploadUrl: string;
}

export interface MediaAsset {
  id: string;
  name: string;
  mimeType: string;
  url: string;
}

/** A Polly voice for narration. */
export interface Voice {
  /** Polly voice id, e.g. `Andres`. */
  id: string;
  /** Display name, e.g. `Andrés`. */
  name: string;
  gender: 'female' | 'male';
  /** BCP 47 code, e.g. `es-MX`. */
  languageCode: string;
}

export interface CatalogComponentInfo {
  key: string;
  name: string;
  group: string;
  groupName: string;
  usage: string;
  propsSchema: Record<string, unknown>;
  defaults: Record<string, unknown>;
  defaultSize: { w: number; h: number };
  usesMedia: boolean;
  isQuestion: boolean;
}

export interface CatalogInfo {
  components: CatalogComponentInfo[];
}
