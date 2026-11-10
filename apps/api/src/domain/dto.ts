/** Shapes returned to GraphQL. `AWSJSON` fields travel as JSON strings, as in AppSync. */

export type DocumentStatus = 'no_content' | 'draft' | 'published';
export type VersionStatus = 'draft' | 'published' | 'archived';

export type TreeNodeKind = 'folder' | 'class';

/** The signed-in person, from their claims. */
export interface MeDto {
  userId: string;
  email: string;
  name: string;
  role: string;
  roleName: string;
  actions: string[];
}

export interface SubcategoryDto {
  id: string;
  categoryId: string;
  name: string;
  displayName: string;
  description: string;
  /** Heading that groups it in the menus; null when it has none. */
  groupName: string | null;
}

export interface CategoryDto {
  id: string;
  name: string;
  displayName: string;
  description: string;
  /** Heading that groups it in the menus; null when it has none. */
  groupName: string | null;
  subcategories: SubcategoryDto[];
}

export interface CategoryPageDto {
  items: CategoryDto[];
  nextToken: string | null;
}

/** A folder or a class of the tree; the document fields are null for folders. */
export interface TreeNodeDto {
  id: string;
  subcategoryId: string;
  parentId: string | null;
  kind: TreeNodeKind;
  name: string;
  displayName: string;
  description: string;
  position: number;
  documentId: string | null;
  documentStatus: DocumentStatus | null;
  currentVersion: number | null;
  publishedVersion: number | null;
}

export interface TreeNodePageDto {
  items: TreeNodeDto[];
  nextToken: string | null;
}

export interface VersionSummaryDto {
  id: string;
  number: number;
  status: VersionStatus;
  createdAt: string;
  publishedAt: string | null;
}

export interface MediaRefDto {
  id: string;
  name: string;
  mimeType: string;
  url: string;
}

export interface ElementDto {
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
  entrance: string;
  /** AWSJSON: a JSON value; AppSync and the local server serialize it for the client. */
  props: Record<string, unknown>;
  mediaId: string | null;
  media: MediaRefDto | null;
}

/** A Polly voice offered for narration. */
export interface VoiceDto {
  id: string;
  name: string;
  gender: 'female' | 'male';
  languageCode: string;
}

export interface VoicePageDto {
  items: VoiceDto[];
  nextToken: string | null;
}

export interface NarrationClipDto {
  id: string;
  slideId: string;
  startsAtS: number;
  script: string;
  /** Polly voice id; null until the person picks one. */
  voice: string | null;
  speed: number;
  generatedDurationS: number;
  audioUrl: string | null;
  speechMarksUrl: string | null;
  status: string;
  errorMessage: string | null;
}

export interface PauseDto {
  id: string;
  slideId: string;
  startsAtS: number;
  durationS: number;
  message: string;
  onEnd: string;
  timerElementId: string | null;
}

export interface AudioClipDto {
  id: string;
  slideId: string;
  mediaId: string;
  media: MediaRefDto | null;
  startsAtS: number;
  durationS: number;
  name: string;
  kind: string;
  volume: number;
}

export interface SlideCommentDto {
  id: string;
  slideId: string;
  authorSub: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface SlideDto {
  id: string;
  versionId: string;
  position: number;
  title: string;
  background: string;
  durationS: number;
  transition: string;
  advance: string;
  elements: ElementDto[];
  narrationClips: NarrationClipDto[];
  pauses: PauseDto[];
  audioClips: AudioClipDto[];
  comments: SlideCommentDto[];
}

export interface DocumentVersionDto {
  id: string;
  documentId: string;
  number: number;
  status: VersionStatus;
  createdAt: string;
  createdBy: string;
  publishedAt: string | null;
  publishedBy: string | null;
  slides: SlideDto[];
}

export interface ClassDocumentDto {
  id: string;
  nodeId: string;
  status: DocumentStatus;
  currentVersion: number;
  publishedVersion: number | null;
  updatedAt: string;
  versions: VersionSummaryDto[];
  editingVersion: DocumentVersionDto;
}

export interface MediaAssetDto {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
}

export interface DeletedResultDto {
  id: string;
  deleted: boolean;
}
