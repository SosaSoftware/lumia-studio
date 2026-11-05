import type { AudioData, DocumentData, ElementData, NarrationData, PauseData, SlideData, VersionData } from './class-data.ts';
import { DOCUMENT_FIELDS, VERSION_FIELDS, decodeDocument, decodeVersion } from './class-data.ts';
import type { StudioGraphql } from './studio-graphql.ts';
import { ToolError } from './tool-error.ts';

/**
 * Maps the ids of a published version to their copies in the new draft. Studio copies slides and their
 * children in order, so items pair by position, as the web does after it creates a draft.
 */
export class IdRemap {
  private constructor(private readonly ids: ReadonlyMap<string, string>) {}

  public static empty(): IdRemap {
    return new IdRemap(new Map());
  }

  public static between(from: VersionData, to: VersionData): IdRemap {
    const ids = new Map<string, string>();
    const pair = (before: readonly { id: string }[], after: readonly { id: string }[]): void => {
      before.forEach((item, index) => {
        const copy = after[index];
        if (copy !== undefined) ids.set(item.id, copy.id);
      });
    };
    from.slides.forEach((slide, index) => {
      const copy = to.slides[index];
      if (copy === undefined) return;
      ids.set(slide.id, copy.id);
      pair(slide.elements, copy.elements);
      pair(slide.narrationClips, copy.narrationClips);
      pair(slide.audioClips, copy.audioClips);
      pair(slide.pauses, copy.pauses);
      pair(slide.comments, copy.comments);
    });
    return new IdRemap(ids);
  }

  /** The draft id of `id`; ids that already belong to the draft come back unchanged. */
  public id(id: string): string {
    return this.ids.get(id) ?? id;
  }

  /** Every pair: id in the published version → id in the new draft. */
  public toRecord(): Record<string, string> {
    return Object.fromEntries(this.ids);
  }
}

/** The draft of a class, ready to edit. */
export interface DraftSession {
  readonly document: DocumentData;
  readonly version: VersionData;
  readonly remap: IdRemap;
  /** Number of the draft version this call created, or null when the draft already existed. */
  readonly createdVersion: number | null;
}

/** What write tools add to their answer when they had to create the draft. */
export interface DraftNotice {
  readonly versionNumber: number;
  readonly note: string;
  /** Id in the version Lumi read → id in the new draft, for slides, components, narrations, audios, pauses and comments. */
  readonly idMap: Readonly<Record<string, string>>;
}

export function draftNotice(session: DraftSession): { draft?: DraftNotice } {
  if (session.createdVersion === null) return {};
  return {
    draft: {
      versionNumber: session.createdVersion,
      note: `Se creó la versión ${String(session.createdVersion)} en borrador para este cambio; los ids cambiaron: usa idMap para pasar de los anteriores a los nuevos.`,
      idMap: session.remap.toRecord(),
    },
  };
}

export async function readDocument(studio: StudioGraphql, nodeId: string): Promise<DocumentData | null> {
  const data = await studio.request(`query($n: ID!) { document(nodeId: $n) { ${DOCUMENT_FIELDS} } }`, { n: nodeId });
  return decodeDocument(data.document);
}

/** Opens the draft of a class: creates the document of an empty class or the next draft of a published one. */
export async function openDraft(studio: StudioGraphql, nodeId: string): Promise<DraftSession> {
  const current = await readDocument(studio, nodeId);
  if (current === null) {
    const created = decodeDocument((await studio.request(`mutation($n: ID!) { createDocument(nodeId: $n) { ${DOCUMENT_FIELDS} } }`, { n: nodeId })).createDocument);
    if (created === null) throw ToolError.unavailable();
    return { document: created, version: created.editingVersion, remap: IdRemap.empty(), createdVersion: created.editingVersion.number };
  }
  if (current.editingVersion.status !== 'published') {
    return { document: current, version: current.editingVersion, remap: IdRemap.empty(), createdVersion: null };
  }
  const draft = decodeVersion((await studio.request(`mutation($d: ID!) { createVersion(documentId: $d) { ${VERSION_FIELDS} } }`, { d: current.id })).createVersion);
  return {
    document: { ...current, editingVersion: draft },
    version: draft,
    remap: IdRemap.between(current.editingVersion, draft),
    createdVersion: draft.number,
  };
}

// -- Lookups in the draft ----------------------------------------------------------------------

export function findSlide(version: VersionData, slideId: string): SlideData {
  const slide = version.slides.find((candidate) => candidate.id === slideId);
  if (slide === undefined) throw ToolError.notFound(`La diapositiva ${slideId} no está en la clase.`);
  return slide;
}

function findChild<T extends { id: string }>(version: VersionData, id: string, pick: (slide: SlideData) => readonly T[], what: string): { slide: SlideData; item: T } {
  for (const slide of version.slides) {
    const item = pick(slide).find((candidate) => candidate.id === id);
    if (item !== undefined) return { slide, item };
  }
  throw ToolError.notFound(`${what} ${id} no está en la clase.`);
}

export function findElement(version: VersionData, elementId: string): { slide: SlideData; item: ElementData } {
  return findChild(version, elementId, (slide) => slide.elements, 'El componente');
}

export function findNarration(version: VersionData, clipId: string): { slide: SlideData; item: NarrationData } {
  return findChild(version, clipId, (slide) => slide.narrationClips, 'La narración');
}

export function findAudio(version: VersionData, clipId: string): { slide: SlideData; item: AudioData } {
  return findChild(version, clipId, (slide) => slide.audioClips, 'El audio');
}

export function findPause(version: VersionData, pauseId: string): { slide: SlideData; item: PauseData } {
  return findChild(version, pauseId, (slide) => slide.pauses, 'La pausa');
}
