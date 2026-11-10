import { strToU8, zipSync } from 'fflate';
import type { Zippable } from 'fflate';
import { componentCatalog } from '@lumia/packages/catalog';
import type { DocumentVersionDto } from '../domain/dto.ts';
import type { ExportSource, GroupedLevel, StoredMedia, StoredNarration } from '../repositories/export-repository.ts';

/** Version of the `definition.json` format that a Lumia player reads. */
export const LUMIA_FORMAT_VERSION = 1;
export const DEFINITION_FILE = 'definition.json';

/** Lowercase letters, digits and hyphens, without accents: `Educación Básica` becomes `educacion-basica`. */
export function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** A level of the path: the group joined to the logical name when there is a group (`academias-academia-lumia`). */
function pathLevel(level: GroupedLevel): string {
  const group = level.groupName === null ? '' : slug(level.groupName);
  return group === '' ? level.name : `${group}-${level.name}`;
}

/** Key of the export: `{group}-{category}/{group}-{subcategory}/{folders}/{class}.lumia`, from the tree. */
export function exportKey(source: ExportSource): string {
  return [pathLevel(source.category), pathLevel(source.subcategory), ...source.folders.map((folder) => folder.name), source.node.name].join('/');
}

function lastSegment(key: string): string {
  return key.slice(key.lastIndexOf('/') + 1);
}

/** Path of a medium inside the .lumia file. */
export function mediaPath(media: StoredMedia): string {
  return `media/${media.id}/${lastSegment(media.key)}`;
}

/** Every medium the version references: the media of the components (including gallery items) and the audio clips. */
export function referencedMedia(version: DocumentVersionDto): string[] {
  const ids = new Set<string>();
  for (const slide of version.slides) {
    for (const element of slide.elements) {
      for (const id of componentCatalog.mediaIds(element.component, parseProps(element.props))) ids.add(id);
    }
    for (const clip of slide.audioClips) ids.add(clip.mediaId);
  }
  return [...ids].sort();
}

function parseProps(props: unknown): Record<string, unknown> {
  try {
    const parsed: unknown = typeof props === 'string' ? JSON.parse(props) : props;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? { ...parsed } : {};
  } catch {
    return {};
  }
}

export interface NarrationPaths {
  readonly audio: string;
  readonly speechMarks: string | null;
}

export function narrationPaths(narration: StoredNarration): NarrationPaths {
  return { audio: `narration/${narration.id}.mp3`, speechMarks: narration.speechMarksKey === null ? null : `narration/${narration.id}.marks.json` };
}

/** `definition.json`: everything a player needs to render the class, the same content the preview shows. */
export function buildDefinition(
  source: ExportSource,
  version: DocumentVersionDto,
  media: readonly StoredMedia[],
  narration: readonly StoredNarration[],
  exportedAt: Date,
): Record<string, unknown> {
  const narrationById = new Map(narration.map((clip) => [clip.id, narrationPaths(clip)]));
  return {
    format: 'lumia',
    formatVersion: LUMIA_FORMAT_VERSION,
    exportedAt: exportedAt.toISOString(),
    class: {
      nodeId: source.nodeId,
      name: source.node.name,
      displayName: source.node.displayName,
      description: source.node.description,
      category: source.category,
      subcategory: source.subcategory,
      folders: source.folders,
    },
    version: { number: version.number, publishedAt: version.publishedAt, publishedBy: version.publishedBy },
    slides: version.slides.map((slide) => ({
      id: slide.id,
      position: slide.position,
      title: slide.title,
      background: slide.background,
      durationS: slide.durationS,
      transition: slide.transition,
      advance: slide.advance,
      elements: slide.elements.map((element) => ({
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
        props: parseProps(element.props),
      })),
      narrationClips: slide.narrationClips.map((clip) => {
        const files = narrationById.get(clip.id);
        return {
          id: clip.id,
          startsAtS: clip.startsAtS,
          script: clip.script,
          voice: clip.voice,
          speed: clip.speed,
          durationS: clip.generatedDurationS,
          audio: files?.audio ?? null,
          speechMarks: files?.speechMarks ?? null,
        };
      }),
      pauses: slide.pauses.map((pause) => ({
        id: pause.id,
        startsAtS: pause.startsAtS,
        durationS: pause.durationS,
        message: pause.message,
        onEnd: pause.onEnd,
        timerElementId: pause.timerElementId,
      })),
      audioClips: slide.audioClips.map((clip) => ({
        id: clip.id,
        mediaId: clip.mediaId,
        startsAtS: clip.startsAtS,
        durationS: clip.durationS,
        name: clip.name,
        kind: clip.kind,
        volume: clip.volume,
      })),
    })),
    media: Object.fromEntries(media.map((item) => [item.id, { path: mediaPath(item), name: item.name, mimeType: item.mimeType, sizeBytes: item.sizeBytes }])),
  };
}

/** A file of the archive and its content. */
export interface ArchiveFile {
  readonly path: string;
  readonly body: Uint8Array;
}

/** The .lumia file: a zip with `definition.json` and the files it names. Media are stored as they are (already compressed). */
export function buildArchive(definition: Record<string, unknown>, files: readonly ArchiveFile[]): Uint8Array {
  const entries: Zippable = { [DEFINITION_FILE]: [strToU8(`${JSON.stringify(definition, null, 2)}\n`), { level: 6 }] };
  for (const file of files) entries[file.path] = [file.body, { level: 0 }];
  return zipSync(entries);
}

