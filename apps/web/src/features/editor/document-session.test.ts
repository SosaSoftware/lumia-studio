import { describe, expect, it, vi } from 'vitest';
import type { ClassDocument, Slide, SlideElement, TreeNode } from '../../api/types.ts';
import { ApiError } from '../../api/graphql-client.ts';
import { CatalogStore } from './catalog-store.ts';
import { DocumentSession } from './document-session.ts';
import type { DocumentApi } from './document-session.ts';

const NODE: TreeNode = {
  id: 'class-1',
  subcategoryId: 'sub-1',
  parentId: 'folder-1',
  kind: 'class',
  name: 'clase-1.lumia',
  displayName: 'Clase 1',
  description: '',
  position: 1,
  documentId: null,
  documentStatus: 'no_content',
  currentVersion: null,
  publishedVersion: null,
};

function element(id: string, slideId: string): SlideElement {
  return { id, slideId, component: 'title', name: 'Título', x: 6, y: 4, w: 88, h: 9, z: 1, appearsAtS: 0, entrance: 'none', props: { text: 'Hola', level: 'h2', align: 'left' }, mediaId: null, media: null };
}

function slide(id: string, versionId: string, elementId: string): Slide {
  return { id, versionId, position: 1, type: 'cover', title: 'Portada', background: 'primary', durationS: 8, transition: 'none', advance: 'click', elements: [element(elementId, id)], narrationClips: [], pauses: [], audioClips: [], comments: [] };
}

function documentOf(status: 'draft' | 'published', version: string, slideId: string, elementId: string, number: number): ClassDocument {
  return {
    id: 'doc-1',
    nodeId: 'class-1',
    status,
    currentVersion: number,
    publishedVersion: status === 'published' ? number : null,
    versions: [],
    editingVersion: { id: version, documentId: 'doc-1', number, status, slides: [slide(slideId, version, elementId)] },
  };
}

function fakeApi(overrides: Partial<DocumentApi>): DocumentApi {
  const unexpected = (): never => {
    throw new Error('Unexpected call');
  };
  return {
    document: unexpected,
    createDocument: unexpected,
    createVersion: unexpected,
    publishVersion: unexpected,
    saveSlide: unexpected,
    reorderSlides: unexpected,
    duplicateSlide: unexpected,
    deleteSlide: unexpected,
    saveElement: unexpected,
    deleteElement: unexpected,
    applySlidesDraft: unexpected,
    savePause: unexpected,
    deletePause: unexpected,
    saveAudio: unexpected,
    deleteAudio: unexpected,
    saveNarration: unexpected,
    deleteNarration: unexpected,
    generateNarrationFor: unexpected,
    saveComment: unexpected,
    deleteComment: unexpected,
    ...overrides,
  };
}

describe('DocumentSession', () => {
  it('saves a burst of edits once, after the debounce', async () => {
    const saveElement = vi.fn<DocumentApi['saveElement']>((_slide, id) => Promise.resolve(element(id ?? 'new', 'slide-1')));
    const api = fakeApi({ document: () => Promise.resolve(documentOf('draft', 'v1', 'slide-1', 'el-1', 1)), saveElement });
    const session = new DocumentSession(api, new CatalogStore(), () => undefined, 5);
    await session.open(NODE);
    session.updateGeometry('el-1', { x: 10, y: 4, w: 88, h: 9 });
    session.updateGeometry('el-1', { x: 12, y: 4, w: 88, h: 9 });
    session.updateGeometry('el-1', { x: 14, y: 4, w: 80, h: 9 });
    expect(session.state.slides[0]?.elements[0]?.x).toBe(14);
    expect(session.state.pending).toBe(1);
    await session.flush();
    expect(saveElement).toHaveBeenCalledTimes(1);
    expect(saveElement.mock.calls[0]?.[3]).toMatchObject({ x: 14, w: 80, props: { text: 'Hola' } });
    expect(session.state.pending).toBe(0);
  });

  it('keeps the API validation errors by field and clears them after a good save', async () => {
    let fail = true;
    const saveElement = vi.fn<DocumentApi['saveElement']>((_slide, id) => {
      if (fail) return Promise.reject(new ApiError('ValidationError', 'x', { 'props.text': 'Texto requerido.' }));
      return Promise.resolve(element(id ?? 'new', 'slide-1'));
    });
    const api = fakeApi({ document: () => Promise.resolve(documentOf('draft', 'v1', 'slide-1', 'el-1', 1)), saveElement });
    const session = new DocumentSession(api, new CatalogStore(), () => undefined, 5);
    await session.open(NODE);
    session.updateElement('el-1', { props: { text: '', level: 'h2', align: 'left' } });
    await session.flush();
    expect(session.state.fieldErrors['el-1']).toEqual({ 'props.text': 'Texto requerido.' });
    fail = false;
    session.updateElement('el-1', { props: { text: 'Hola', level: 'h2', align: 'left' } });
    await session.flush();
    expect(session.state.fieldErrors['el-1']).toBeUndefined();
  });

  it('creates the next draft before the first edit of a published version and remaps the ids', async () => {
    let published = true;
    const createVersion = vi.fn(() => {
      published = false;
      return Promise.resolve({ id: 'v2', documentId: 'doc-1', number: 2, status: 'draft' as const, slides: [] });
    });
    const saveElement = vi.fn<DocumentApi['saveElement']>((_slide, id) => Promise.resolve(element(id ?? 'new', 'slide-2')));
    const api = fakeApi({
      document: () => Promise.resolve(published ? documentOf('published', 'v1', 'slide-1', 'el-1', 1) : documentOf('draft', 'v2', 'slide-2', 'el-2', 2)),
      createVersion,
      saveElement,
    });
    const session = new DocumentSession(api, new CatalogStore(), () => undefined, 5);
    await session.open(NODE);
    session.selectElement('el-1');
    expect(session.needsPreparation).toBe(true);
    session.updateElement('el-1', { x: 20 });
    await vi.waitFor(() => {
      expect(session.state.notice).toBe('Se creó la versión 2 en borrador.');
    });
    expect(createVersion).toHaveBeenCalledWith('doc-1');
    expect(session.state.selectedElementId).toBe('el-2');
    expect(session.state.selectedSlideId).toBe('slide-2');
    expect(session.state.slides[0]?.elements[0]?.x).toBe(20);
    await session.flush();
    expect(saveElement.mock.calls[0]?.[1]).toBe('el-2');
    expect(session.needsPreparation).toBe(false);
  });

  it('creates the document on the first edit of a class without content', async () => {
    const createDocument = vi.fn(() => Promise.resolve(documentOf('draft', 'v1', 'slide-1', 'el-1', 1)));
    const applySlidesDraft = vi.fn<DocumentApi['applySlidesDraft']>(() => Promise.resolve([slide('slide-1', 'v1', 'el-1')]));
    let created = false;
    const api = fakeApi({
      document: () => Promise.resolve(created ? documentOf('draft', 'v1', 'slide-1', 'el-1', 1) : null),
      createDocument: () => {
        created = true;
        return createDocument();
      },
      applySlidesDraft,
    });
    const session = new DocumentSession(api, new CatalogStore(), () => undefined, 5);
    await session.open(NODE);
    expect(session.state.slides).toHaveLength(0);
    await session.addSlide();
    expect(createDocument).toHaveBeenCalledTimes(1);
    const [versionId, after, drafts] = applySlidesDraft.mock.calls[0] ?? [];
    expect(versionId).toBe('v1');
    // A new slide goes at the end of the class.
    expect(after).toBeNull();
    // A new slide is blank: the type sets its attributes, not its content.
    expect(drafts?.[0]?.type).toBe('explanatory');
    expect(drafts?.[0]?.elements).toEqual([]);
    expect(session.state.slides).toHaveLength(1);
    expect(session.state.selectedSlideId).toBe('slide-1');
  });
});

describe('DocumentSession timeline', () => {
  function withNarration(status: 'ready' | 'pending'): ClassDocument {
    const document = documentOf('draft', 'v1', 'slide-1', 'el-1', 1);
    const target = document.editingVersion.slides[0];
    if (target !== undefined) {
      target.narrationClips = [{ id: 'n-1', slideId: 'slide-1', startsAtS: 1, script: 'Hola', voice: 'Mia', speed: 1, generatedDurationS: 6, audioUrl: '/a.mp3', status, errorMessage: null }];
    }
    return document;
  }

  it('keeps the generated voice for a new speed and resets it for a new script', async () => {
    const saveNarration = vi.fn<DocumentApi['saveNarration']>((slideId, id, values) =>
      Promise.resolve({ id: id ?? 'n-new', slideId, ...values, generatedDurationS: values.script === 'Hola' ? 6 : 0, audioUrl: values.script === 'Hola' ? '/a.mp3' : null, status: values.script === 'Hola' ? 'ready' : 'pending', errorMessage: null }),
    );
    const api = fakeApi({ document: () => Promise.resolve(withNarration('ready')), saveNarration });
    const session = new DocumentSession(api, new CatalogStore(), () => undefined, 5);
    await session.open(NODE);
    session.updateNarration('n-1', { speed: 2 });
    const clip = session.state.slides[0]?.narrationClips[0];
    expect(clip).toMatchObject({ speed: 2, status: 'ready', audioUrl: '/a.mp3' });
    await session.flush();
    expect(saveNarration).toHaveBeenLastCalledWith('slide-1', 'n-1', { script: 'Hola', startsAtS: 1, voice: 'Mia', speed: 2 });
    session.updateNarration('n-1', { script: 'Otro guion' });
    expect(session.state.slides[0]?.narrationClips[0]).toMatchObject({ status: 'pending', audioUrl: null, generatedDurationS: 0 });
    await session.flush();
    expect(session.state.slides[0]?.narrationClips[0]?.status).toBe('pending');
  });

  it('creates a narration clip without a voice and asks for one before generating', async () => {
    const saveNarration = vi.fn<DocumentApi['saveNarration']>((slideId, id, values) =>
      Promise.resolve({ id: id ?? 'n-new', slideId, ...values, generatedDurationS: 0, audioUrl: null, status: 'pending', errorMessage: null }),
    );
    const generateNarrationFor = vi.fn<DocumentApi['generateNarrationFor']>();
    const api = fakeApi({ document: () => Promise.resolve(documentOf('draft', 'v1', 'slide-1', 'el-1', 1)), saveNarration, generateNarrationFor });
    const session = new DocumentSession(api, new CatalogStore(), () => undefined, 5);
    await session.open(NODE);
    await session.addNarration();
    expect(saveNarration).toHaveBeenCalledWith('slide-1', null, { script: '', startsAtS: 1, voice: null, speed: 1 });
    session.updateNarration('n-new', { script: 'Hola, clase.' });
    await session.generateNarration('n-new');
    expect(generateNarrationFor).not.toHaveBeenCalled();
    expect(session.state.saveError).toBe('Elige una voz de Polly antes de generar la narración.');
  });

  it('appends a pause after the last one, selects it and extends the slide', async () => {
    const savePause = vi.fn<DocumentApi['savePause']>((slideId, id, patch) =>
      Promise.resolve({ id: id ?? 'p-1', slideId, startsAtS: patch.startsAtS ?? 0, durationS: patch.durationS ?? 0, message: patch.message ?? '', onEnd: 'continue', timerElementId: null }),
    );
    const saveSlide = vi.fn<DocumentApi['saveSlide']>(() => Promise.resolve(slide('slide-1', 'v1', 'el-1')));
    const api = fakeApi({ document: () => Promise.resolve(documentOf('draft', 'v1', 'slide-1', 'el-1', 1)), savePause, saveSlide });
    const session = new DocumentSession(api, new CatalogStore(), () => undefined, 5);
    await session.open(NODE);
    await session.addPause();
    expect(savePause).toHaveBeenCalledWith('slide-1', null, { startsAtS: 1, durationS: 10, message: 'Nueva pausa', onEnd: 'continue', timerElementId: null });
    expect(session.state.selectedClip).toEqual({ kind: 'pause', id: 'p-1' });
    expect(session.selectedPause?.durationS).toBe(10);
    expect(session.state.slides[0]?.durationS).toBe(12);
    session.selectElement('el-1');
    expect(session.state.selectedClip).toBeNull();
  });
});
