import type { NextUnlock, StartMode, ThemeColorKey } from '@lumia/packages/catalog';

export type DocumentStatus = 'no_content' | 'draft' | 'published';
export type VersionStatus = 'draft' | 'published' | 'archived';
export type Transition = 'none' | 'fade' | 'slide' | 'zoom';
export type { NextUnlock, StartMode } from '@lumia/packages/catalog';
export type Entrance = 'none' | 'appear' | 'fade' | 'slide' | 'draw';
/** How an element leaves its slide at `disappearsAtS`; `none` keeps it until the slide ends. */
export type Exit = 'none' | 'disappear' | 'fade' | 'slide';

export const TRANSITIONS: readonly Transition[] = ['none', 'fade', 'slide', 'zoom'];
/** Rules of the Next button in the order Properties offers them. */
export const NEXT_UNLOCKS: readonly NextUnlock[] = ['always', 'after_time', 'after_activities', 'custom_button'];
/** How a slide with the rule `after_time` starts, in the order Properties offers them. */
export const START_MODES: readonly StartMode[] = ['auto', 'button'];
export const ENTRANCES: readonly Entrance[] = ['none', 'appear', 'fade', 'slide', 'draw'];
export const EXITS: readonly Exit[] = ['none', 'disappear', 'fade', 'slide'];

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
  exit: Exit;
  /** Second the element leaves the slide; null when `exit` is `none`. */
  disappearsAtS: number | null;
  props: Record<string, unknown>;
  mediaId: string | null;
  media: MediaRef | null;
}

export type NarrationStatus = 'pending' | 'generating' | 'ready' | 'failed';
export type AudioKind = 'music' | 'effect';
export type PauseEnd = 'continue' | 'wait_next';

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
  unlock: NextUnlock;
  startMode: StartMode;
  /** Button that starts the slide when `startMode` is `button`. */
  startElementId: string | null;
  /** Button that replaces the lateral Next when `unlock` is `custom_button`. */
  unlockElementId: string | null;
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
  exit?: Exit;
  disappearsAtS?: number | null;
  props?: Record<string, unknown>;
}

export interface SlidePatch {
  title?: string;
  background?: ThemeColorKey;
  durationS?: number;
  transition?: Transition;
  unlock?: NextUnlock;
  startMode?: StartMode;
  /** Null clears the reference. */
  startElementId?: string | null;
  /** Null clears the reference. */
  unlockElementId?: string | null;
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
  exit?: Exit;
  disappearsAtS?: number | null;
  props: Record<string, unknown>;
}

export interface DraftSlideInput {
  title: string;
  background?: ThemeColorKey;
  durationS?: number;
  transition?: Transition;
  unlock?: NextUnlock;
  startMode?: StartMode;
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
  /** Section and order of each visible prop in the Properties panel. */
  layout: PropertyPlacementInfo[];
}

/** Texts by language code, for example `{ es: 'Contenido', en: 'Content' }`. */
export type LocalizedText = Readonly<Record<string, string>>;

/** A section of the Properties panel, as stored in the database. */
export interface PropertySectionInfo {
  key: string;
  nature: string;
  position: number;
  labels: LocalizedText;
  isFallback: boolean;
}

/** Condition on another prop of the element that shows a field. */
export type VisibleWhen =
  | { prop: string; op: 'empty' | 'notEmpty' }
  | { prop: string; op: 'equals'; value: unknown }
  | { prop: string; op: 'in'; values: readonly unknown[] };

/** Where a prop, or a field every element has (`x`, `entrance`…), goes in the Properties panel. */
export interface PropertyPlacementInfo {
  prop: string;
  section: string;
  position: number;
  advanced: boolean;
  visibleWhen: VisibleWhen | null;
  labels: LocalizedText | null;
  help: LocalizedText | null;
}

export interface CatalogInfo {
  /** Sections of the Properties panel, in panel order. */
  sections: PropertySectionInfo[];
  /** Placement of the fields every element has: geometry, entrance and appearance time. */
  elementLayout: PropertyPlacementInfo[];
  /** Placement of the fields of a slide: title, unlock rule, duration, background and transition. */
  slideLayout: PropertyPlacementInfo[];
  components: CatalogComponentInfo[];
}
