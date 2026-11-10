import { strFromU8, unzipSync } from 'fflate';
import { componentCatalog } from '@lumia/packages/catalog';
import { decodeSlide, list, rec, str } from '../../api/decode.ts';
import { t } from '../../i18n/index.ts';
import type { MediaRef, Slide } from '../../api/types.ts';

/** Format written by the export of the API (`definition.json` inside the zip). */
const DEFINITION_FILE = 'definition.json';
const FORMAT = 'lumia';
const FORMAT_VERSION = 1;

/** A published class opened from its .lumia file, ready for the player. */
export interface LumiaClass {
  readonly displayName: string;
  readonly slides: Slide[];
  readonly media: (id: string) => MediaRef | null;
  /** Frees the browser URLs of the files of the class. */
  dispose(): void;
}

export class LumiaFileError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'LumiaFileError';
  }
}

/** Creates and frees browser URLs for the files of the class; tests replace them. */
export interface ObjectUrls {
  create(blob: Blob): string;
  revoke(url: string): void;
}

const BROWSER_URLS: ObjectUrls = {
  create: (blob) => URL.createObjectURL(blob),
  revoke: (url) => {
    URL.revokeObjectURL(url);
  },
};

type FileUrl = (path: unknown, mimeType: string) => string | null;

function readDefinition(files: Readonly<Record<string, Uint8Array>>): Record<string, unknown> {
  const raw = files[DEFINITION_FILE];
  if (raw === undefined) throw new LumiaFileError(t('demo.missingDefinition'));
  let definition: unknown;
  try {
    definition = JSON.parse(strFromU8(raw));
  } catch {
    throw new LumiaFileError(t('demo.invalidDefinition'));
  }
  const value = rec(definition);
  if (value.format !== FORMAT || value.formatVersion !== FORMAT_VERSION) {
    throw new LumiaFileError(t('demo.wrongVersion', { version: FORMAT_VERSION }));
  }
  return value;
}

/** The slide of `definition.json` in the shape of the API, so the decoders of the editor validate it. */
function toSlide(raw: unknown, media: ReadonlyMap<string, MediaRef>, fileUrl: FileUrl): Slide {
  const slide = rec(raw);
  const slideId = str(slide.id);
  return decodeSlide({
    ...slide,
    versionId: 'lumia',
    elements: list(slide.elements).map((value) => {
      const element = rec(value);
      const props = rec(element.props);
      const mediaId = componentCatalog.hasMediaField(str(element.component)) && typeof props.mediaId === 'string' ? props.mediaId : null;
      return { ...element, slideId, props, mediaId, media: mediaId === null ? null : (media.get(mediaId) ?? null) };
    }),
    narrationClips: list(slide.narrationClips).map((value) => {
      const clip = rec(value);
      const audioUrl = fileUrl(clip.audio, 'audio/mpeg');
      // A narration without generated voice is not in the file; the player skips it.
      return { ...clip, slideId, generatedDurationS: clip.durationS, audioUrl, status: audioUrl === null ? 'pending' : 'ready' };
    }),
    pauses: list(slide.pauses).map((value) => ({ ...rec(value), slideId })),
    audioClips: list(slide.audioClips).map((value) => {
      const clip = rec(value);
      return { ...clip, slideId, media: media.get(str(clip.mediaId)) ?? null };
    }),
    comments: [],
  });
}

/** Opens a .lumia file: a zip with `definition.json` and the files it names. */
export function openLumia(bytes: Uint8Array, urls: ObjectUrls = BROWSER_URLS): LumiaClass {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new LumiaFileError(t('demo.invalidFile'));
  }
  const definition = readDefinition(files);
  const created: string[] = [];
  const fileUrl: FileUrl = (path, mimeType) => {
    const body = typeof path === 'string' ? files[path] : undefined;
    if (body === undefined) return null;
    // A copy on its own ArrayBuffer: the zip reader returns views of one buffer, which Blob does not take as such.
    const url = urls.create(new Blob([body.slice()], { type: mimeType }));
    created.push(url);
    return url;
  };
  const media = new Map<string, MediaRef>();
  for (const [id, value] of Object.entries(rec(definition.media))) {
    const item = rec(value);
    const mimeType = str(item.mimeType, 'application/octet-stream');
    const url = fileUrl(item.path, mimeType);
    if (url !== null) media.set(id, { id, name: str(item.name), mimeType, url });
  }
  const slides = list(definition.slides)
    .map((value) => toSlide(value, media, fileUrl))
    .sort((a, b) => a.position - b.position);
  return {
    displayName: str(rec(definition.class).displayName),
    slides,
    media: (id) => media.get(id) ?? null,
    dispose: () => {
      for (const url of created) urls.revoke(url);
    },
  };
}
