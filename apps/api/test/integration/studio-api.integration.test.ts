import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { componentCatalog, slideLayoutEngine } from '@lumia/packages/catalog';
import { ACTIONS, ClaimsBuilder } from '../../src/auth/index.ts';
import type { StudioClaims } from '../../src/auth/index.ts';
import type { CategoryPageDto, ClassDocumentDto, DocumentVersionDto, SlideDto, TreeNodeDto, TreeNodePageDto } from '../../src/domain/dto.ts';
import { createDatabase } from '../../src/infrastructure/db/index.ts';
import type { CloseableDatabase } from '../../src/infrastructure/db/index.ts';
import { FileSystemObjectStorage } from '../../src/infrastructure/storage/index.ts';
import type { ObjectStorage } from '../../src/infrastructure/storage/index.ts';
import { StudioRuntime } from '../../src/runtime/index.ts';
import { Logger } from '../../src/shared/log/index.ts';
import { FakeSpeechSynthesizer } from '../support/fake-speech-synthesizer.ts';
import { StudioPipeline } from '../support/studio-pipeline.ts';
import { TreeFixture } from '../support/tree-fixture.ts';
import type { TreeFixtureData } from '../support/tree-fixture.ts';

let admin: CloseableDatabase;
let studioDb: CloseableDatabase;
let storageRoot: string;
let storage: ObjectStorage;
let fixture: TreeFixture;
let data: TreeFixtureData;
let pipeline: StudioPipeline;
let creator: StudioClaims;
let mathCreator: StudioClaims;
let viewer: StudioClaims;
let outsider: StudioClaims;

const claimsOf = (email: string): Promise<StudioClaims> => new ClaimsBuilder(studioDb).build(email, `test-${email}`);

function defaultsOf(component: string): Record<string, unknown> {
  const defaults = componentCatalog.get(component)?.defaults;
  return typeof defaults === 'object' && defaults !== null ? { ...defaults } : {};
}

/** A slide draft built with the catalog defaults and the layout engine, as Lumi would send it. */
function draftSlide(type: 'cover' | 'explanatory' | 'quiz', title: string): Record<string, unknown> {
  const components = type === 'quiz' ? ['title', 'multiple_choice'] : ['title', 'paragraph'];
  const placed = slideLayoutEngine.place(type, components.map((component) => ({ component })));
  return {
    type,
    title,
    elements: components.map((component, index) => ({
      component,
      ...placed[index],
      props: JSON.stringify({ ...defaultsOf(component), ...(component === 'title' ? { text: title } : {}) }),
    })),
  };
}

const run = (claims: StudioClaims | null, type: 'Query' | 'Mutation', field: string, args?: Record<string, unknown>): Promise<unknown> =>
  pipeline.run(claims, type, field, args);

async function nodesOf(claims: StudioClaims, subcategoryId: string): Promise<TreeNodeDto[]> {
  return ((await run(claims, 'Query', 'treeNodes', { filter: { subcategoryId } })) as TreeNodePageDto).items;
}

async function classState(nodeId: string): Promise<TreeNodeDto | undefined> {
  return (await nodesOf(creator, data.aiSubcategoryId)).find((node) => node.id === nodeId);
}

beforeAll(async () => {
  admin = createDatabase('admin');
  studioDb = createDatabase('studio_app');
  fixture = new TreeFixture(admin, 'itest-api');
  data = await fixture.create();
  storageRoot = await mkdtemp(path.join(tmpdir(), 'lumia-studio-'));
  storage = new FileSystemObjectStorage({ root: storageRoot, baseUrl: 'http://localhost:4000', signingSecret: 'test-signing-secret-0123456789' });
  [creator, mathCreator, viewer, outsider] = await Promise.all([
    claimsOf(data.emails.creator),
    claimsOf(data.emails.mathCreator),
    claimsOf(data.emails.viewer),
    claimsOf(data.emails.outsider),
  ]);
  StudioRuntime.use(new StudioRuntime(studioDb, storage, new FakeSpeechSynthesizer(), new Logger({}, { write: () => undefined })));
  pipeline = await StudioPipeline.create(admin);
});

afterAll(async () => {
  StudioRuntime.use(undefined);
  await fixture.remove();
  await Promise.all([admin.close(), studioDb.close()]);
  await rm(storageRoot, { recursive: true, force: true });
});

describe('content tree', () => {
  it('gives each person only the categories and subcategories granted', async () => {
    const categoryOf = async (claims: StudioClaims, id: string): Promise<CategoryPageDto['items'][number] | undefined> =>
      ((await run(claims, 'Query', 'categories')) as CategoryPageDto).items.find((category) => category.id === id);
    expect((await categoryOf(creator, data.categoryId))?.subcategories.map((subcategory) => subcategory.name)).toEqual(['inteligencia-artificial', 'matematicas']);
    expect((await categoryOf(mathCreator, data.categoryId))?.subcategories.map((subcategory) => subcategory.name)).toEqual(['matematicas']);
    expect(await categoryOf(outsider, data.categoryId)).toBeUndefined();
    expect((await categoryOf(outsider, data.otherCategoryId))?.displayName).toBe('Otra categoría');
  });

  it('lists the folders and classes of a subcategory with their parent and state', async () => {
    const nodes = await nodesOf(creator, data.aiSubcategoryId);
    const folder = nodes.find((node) => node.id === data.folderId);
    expect(folder).toMatchObject({ kind: 'folder', name: 'primero', displayName: 'Primero', parentId: null, documentStatus: null });
    const lifecycle = nodes.find((node) => node.id === data.classes.lifecycle);
    expect(lifecycle).toMatchObject({
      kind: 'class',
      name: 'ciclo-de-vida.lumia',
      displayName: 'Ciclo de vida',
      description: 'Descripción de Ciclo de vida',
      parentId: data.folderId,
      documentStatus: 'no_content',
      documentId: null,
    });
  });

  it('refuses the tree of a subcategory that was not granted', async () => {
    await expect(nodesOf(mathCreator, data.aiSubcategoryId)).rejects.toMatchObject({ errorType: 'Unauthorized' });
    await expect(nodesOf(outsider, data.aiSubcategoryId)).rejects.toMatchObject({ errorType: 'Unauthorized' });
    expect(await nodesOf(mathCreator, data.mathSubcategoryId)).toHaveLength(1);
  });
});

describe('class life cycle', () => {
  let document: ClassDocumentDto;
  let slides: SlideDto[];

  it('has no content at first', async () => {
    expect(await run(creator, 'Query', 'document', { nodeId: data.classes.lifecycle })).toBeNull();
  });

  it('creates the document and version 1 in draft, only for a class', async () => {
    document = (await run(creator, 'Mutation', 'createDocument', { nodeId: data.classes.lifecycle })) as ClassDocumentDto;
    expect(document).toMatchObject({ nodeId: data.classes.lifecycle, status: 'draft', currentVersion: 1 });
    expect(document.versions.map((version) => [version.number, version.status])).toEqual([[1, 'draft']]);
    expect(document.editingVersion.slides).toEqual([]);
    expect(await classState(data.classes.lifecycle)).toMatchObject({ documentStatus: 'draft', currentVersion: 1, publishedVersion: null, documentId: document.id });
    await expect(run(creator, 'Mutation', 'createDocument', { nodeId: data.classes.lifecycle })).rejects.toMatchObject({ errorType: 'Conflict' });
    await expect(run(creator, 'Mutation', 'createDocument', { nodeId: data.folderId })).rejects.toMatchObject({ errorType: 'ValidationError' });
  });

  it('applies a draft of three slides with elements', async () => {
    slides = (await run(creator, 'Mutation', 'applySlidesDraft', {
      versionId: document.editingVersion.id,
      slides: [draftSlide('cover', 'Fracciones'), draftSlide('explanatory', 'Qué es una fracción'), draftSlide('quiz', 'Comprueba')],
    })) as SlideDto[];
    expect(slides.map((slide) => [slide.position, slide.type, slide.elements.length])).toEqual([[1, 'cover', 2], [2, 'explanatory', 2], [3, 'quiz', 2]]);
    expect(slides[0]?.elements[0]?.props).toMatchObject({ text: 'Fracciones' });
  });

  it('cannot publish a version without slides', async () => {
    const empty = (await run(creator, 'Mutation', 'createDocument', { nodeId: data.classes.empty })) as ClassDocumentDto;
    await expect(run(creator, 'Mutation', 'publishVersion', { documentId: empty.id })).rejects.toMatchObject({ errorType: 'ValidationError' });
  });

  it('publishes version 1', async () => {
    const published = (await run(creator, 'Mutation', 'publishVersion', { documentId: document.id })) as ClassDocumentDto;
    expect(published).toMatchObject({ status: 'published', currentVersion: 1, publishedVersion: 1 });
    expect(published.versions.map((version) => version.status)).toEqual(['published']);
    expect(await classState(data.classes.lifecycle)).toMatchObject({ documentStatus: 'published', currentVersion: 1, publishedVersion: 1 });
    await expect(run(creator, 'Mutation', 'publishVersion', { documentId: document.id })).rejects.toMatchObject({ errorType: 'Conflict' });
  });

  it('refuses edits on the published version and keeps version 1 intact', async () => {
    const [first] = slides;
    const edits: [string, Record<string, unknown>][] = [
      ['saveSlide', { input: { versionId: document.editingVersion.id, type: 'closing' } }],
      ['deleteSlide', { slideId: first?.id }],
      ['duplicateSlide', { slideId: first?.id }],
      ['saveComment', { slideId: first?.id, body: 'Hola' }],
      ['deleteElement', { elementId: first?.elements[0]?.id }],
    ];
    for (const [field, args] of edits) {
      await expect(run(creator, 'Mutation', field, args)).rejects.toMatchObject({ errorType: 'Conflict' });
    }
    const version = (await run(creator, 'Query', 'version', { id: document.editingVersion.id })) as DocumentVersionDto;
    expect(version.slides).toHaveLength(3);
  });

  it('creates version 2 as a copy and leaves version 1 published', async () => {
    const draft = (await run(creator, 'Mutation', 'createVersion', { documentId: document.id })) as DocumentVersionDto;
    expect(draft).toMatchObject({ number: 2, status: 'draft' });
    expect(draft.slides.map((slide) => [slide.position, slide.title, slide.elements.length])).toEqual(slides.map((slide) => [slide.position, slide.title, slide.elements.length]));
    expect(draft.slides.every((copy) => slides.every((original) => original.id !== copy.id))).toBe(true);
    await expect(run(creator, 'Mutation', 'createVersion', { documentId: document.id })).rejects.toMatchObject({ errorType: 'Conflict' });

    const current = (await run(creator, 'Query', 'document', { nodeId: data.classes.lifecycle })) as ClassDocumentDto;
    expect(current).toMatchObject({ status: 'draft', currentVersion: 2, publishedVersion: 1 });
    expect(current.versions.map((version) => [version.number, version.status])).toEqual([[1, 'published'], [2, 'draft']]);
    expect(current.editingVersion.id).toBe(draft.id);

    const [copyOfFirst] = draft.slides;
    await run(creator, 'Mutation', 'saveSlide', { input: { id: copyOfFirst?.id, versionId: draft.id, title: 'Portada v2' } });
    const v1 = (await run(creator, 'Query', 'version', { id: document.editingVersion.id })) as DocumentVersionDto;
    expect(v1).toMatchObject({ status: 'published', number: 1 });
    expect(v1.slides[0]?.title).toBe('Fracciones');
  });

  it('archives version 1 when version 2 is published', async () => {
    const published = (await run(creator, 'Mutation', 'publishVersion', { documentId: document.id })) as ClassDocumentDto;
    expect(published.versions.map((version) => [version.number, version.status])).toEqual([[1, 'archived'], [2, 'published']]);
  });
});

describe('slide editing', () => {
  let version: DocumentVersionDto;

  beforeAll(async () => {
    const document = (await run(creator, 'Mutation', 'createDocument', { nodeId: data.classes.editing })) as ClassDocumentDto;
    version = document.editingVersion;
  });

  it('creates, reorders, duplicates and deletes slides keeping consecutive positions', async () => {
    const make = async (title: string, position?: number): Promise<SlideDto> =>
      (await run(creator, 'Mutation', 'saveSlide', { input: { versionId: version.id, type: 'explanatory', title, ...(position === undefined ? {} : { position }) } })) as SlideDto;
    const a = await make('A');
    const b = await make('B');
    const c = await make('C', 1);
    const positions = async (): Promise<string[]> =>
      ((await run(creator, 'Query', 'version', { id: version.id })) as DocumentVersionDto).slides.map((slide) => `${String(slide.position)}${slide.title}`);
    expect(await positions()).toEqual(['1C', '2A', '3B']);

    await run(creator, 'Mutation', 'reorderSlides', { versionId: version.id, slideIds: [a.id, b.id, c.id] });
    expect(await positions()).toEqual(['1A', '2B', '3C']);
    await expect(run(creator, 'Mutation', 'reorderSlides', { versionId: version.id, slideIds: [a.id, b.id] })).rejects.toMatchObject({ errorType: 'ValidationError' });

    await run(creator, 'Mutation', 'saveElement', { input: { slideId: a.id, component: 'title', props: JSON.stringify({ text: 'Hola', level: 'h2', align: 'left' }) } });
    const copy = (await run(creator, 'Mutation', 'duplicateSlide', { slideId: a.id })) as SlideDto;
    expect(copy).toMatchObject({ position: 2, title: 'A' });
    expect(copy.elements).toHaveLength(1);
    expect(copy.elements[0]?.id).not.toBe(((await run(creator, 'Query', 'version', { id: version.id })) as DocumentVersionDto).slides[0]?.elements[0]?.id);
    expect(await positions()).toEqual(['1A', '2A', '3B', '4C']);

    await expect(run(creator, 'Mutation', 'deleteSlide', { slideId: copy.id })).resolves.toEqual({ id: copy.id, deleted: true });
    expect(await positions()).toEqual(['1A', '2B', '3C']);
  });

  it('saves elements with default geometry, pauses and comments signed with the name of the person', async () => {
    const slide = (await run(creator, 'Mutation', 'saveSlide', { input: { versionId: version.id, type: 'video', title: 'Video' } })) as SlideDto;
    const element = (await run(creator, 'Mutation', 'saveElement', {
      input: { slideId: slide.id, component: 'video', props: JSON.stringify({ ...defaultsOf('video') }) },
    })) as SlideDto['elements'][number];
    expect(element).toMatchObject({ w: 64, h: 36, x: 18, mediaId: null, media: null });

    const pause = (await run(creator, 'Mutation', 'savePause', {
      input: { slideId: slide.id, startsAtS: 5, durationS: 0, message: 'Piensa', onEnd: 'wait_click', timerElementId: element.id },
    })) as { id: string };
    expect(pause).toMatchObject({ message: 'Piensa', onEnd: 'wait_click', timerElementId: element.id });
    await expect(
      run(creator, 'Mutation', 'savePause', { input: { slideId: slide.id, startsAtS: 1, durationS: 1, message: '', onEnd: 'continue', timerElementId: slide.id } }),
    ).rejects.toMatchObject({ errorType: 'ValidationError' });

    const comment = (await run(creator, 'Mutation', 'saveComment', { slideId: slide.id, body: '  Revisar  ' })) as { id: string; body: string; authorName: string };
    expect(comment).toMatchObject({ body: 'Revisar', authorName: 'Creadora de prueba' });
    const reloaded = (await run(creator, 'Query', 'version', { id: version.id })) as DocumentVersionDto;
    const stored = reloaded.slides.find((candidate) => candidate.id === slide.id);
    expect([stored?.pauses.length, stored?.comments.length]).toEqual([1, 1]);
    await run(creator, 'Mutation', 'deleteComment', { commentId: comment.id });
    await run(creator, 'Mutation', 'deletePause', { pauseId: pause.id });
    const cleared = ((await run(creator, 'Query', 'version', { id: version.id })) as DocumentVersionDto).slides.find((candidate) => candidate.id === slide.id);
    expect([cleared?.pauses.length, cleared?.comments.length]).toEqual([0, 0]);
  });

  it('rejects invalid props, geometry out of range and unknown components', async () => {
    const [slide] = ((await run(creator, 'Query', 'version', { id: version.id })) as DocumentVersionDto).slides;
    const title = { text: 'Hola', level: 'h2', align: 'left' };
    const save = (input: Record<string, unknown>): Promise<unknown> =>
      run(creator, 'Mutation', 'saveElement', { input: { slideId: slide?.id, component: 'title', props: JSON.stringify(title), ...input } });
    await expect(save({ props: JSON.stringify({ ...title, level: 'h9' }) })).rejects.toMatchObject({
      errorType: 'ValidationError', message: expect.stringContaining('props.level') as string,
    });
    await expect(save({ x: 50, w: 80 })).rejects.toMatchObject({ errorType: 'ValidationError', message: expect.stringContaining('geometry') as string });
    await expect(save({ component: 'hologram' })).rejects.toMatchObject({ errorType: 'ValidationError' });

    const before = ((await run(creator, 'Query', 'version', { id: version.id })) as DocumentVersionDto).slides.length;
    const bad = draftSlide('quiz', 'Roto');
    const elements = bad.elements as { props: string }[];
    await expect(
      run(creator, 'Mutation', 'applySlidesDraft', {
        versionId: version.id,
        slides: [draftSlide('cover', 'Bueno'), { ...bad, elements: elements.map((element) => ({ ...element, props: JSON.stringify({ text: 5 }) })) }],
      }),
    ).rejects.toMatchObject({ errorType: 'ValidationError' });
    expect(((await run(creator, 'Query', 'version', { id: version.id })) as DocumentVersionDto).slides).toHaveLength(before);
  });

  it('inserts a draft after a given position', async () => {
    const before = ((await run(creator, 'Query', 'version', { id: version.id })) as DocumentVersionDto).slides;
    await run(creator, 'Mutation', 'applySlidesDraft', { versionId: version.id, afterPosition: 1, slides: [draftSlide('cover', 'Nueva')] });
    const after = ((await run(creator, 'Query', 'version', { id: version.id })) as DocumentVersionDto).slides;
    expect(after.map((slide) => slide.position)).toEqual(after.map((_, index) => index + 1));
    expect(after[1]?.title).toBe('Nueva');
    expect(after).toHaveLength(before.length + 1);
  });

  it('tells the person their role and actions', async () => {
    expect(await run(creator, 'Query', 'me', {})).toMatchObject({ userId: creator.studio_user_id, role: creator.studio_role, actions: creator.studio_actions });
    expect(((await run(viewer, 'Query', 'me', {})) as { actions: string[] }).actions).toEqual([ACTIONS.documentsView]);
  });

  it('keeps the media library of each category and only attaches media of the class category', async () => {
    const input = { categoryId: data.categoryId, name: 'foto.png', mimeType: 'image/png', sizeBytes: 3 };
    const upload = (await run(creator, 'Mutation', 'createMediaUpload', { input })) as { key: string; uploadUrl: string };
    await expect(run(creator, 'Mutation', 'registerMedia', { input: { ...input, key: upload.key } })).rejects.toMatchObject({ errorType: 'ValidationError' });
    await storage.put(upload.key, new Uint8Array([1, 2, 3]), 'image/png');
    const asset = (await run(creator, 'Mutation', 'registerMedia', { input: { ...input, key: upload.key } })) as { id: string; url: string };
    expect(asset.url).toContain('signature=');
    expect(((await run(creator, 'Mutation', 'registerMedia', { input: { ...input, key: upload.key } })) as { id: string }).id).toBe(asset.id);

    const library = (await run(creator, 'Query', 'mediaLibrary', { filter: { categoryId: data.categoryId, mimePrefix: 'image/', text: 'FOTO' }, page: { limit: 5 } })) as { items: { id: string }[] };
    expect(library.items.map((item) => item.id)).toContain(asset.id);
    await expect(run(outsider, 'Query', 'mediaLibrary', { filter: { categoryId: data.categoryId } })).rejects.toMatchObject({ errorType: 'Unauthorized' });
    await expect(run(creator, 'Mutation', 'createMediaUpload', { input: { ...input, categoryId: data.otherCategoryId } })).rejects.toMatchObject({ errorType: 'Unauthorized' });

    const [slide] = ((await run(creator, 'Query', 'version', { id: version.id })) as DocumentVersionDto).slides;
    const image = (await run(creator, 'Mutation', 'saveElement', {
      input: { slideId: slide?.id, component: 'image', mediaId: asset.id, props: JSON.stringify({ ...defaultsOf('image') }) },
    })) as SlideDto['elements'][number];
    expect(image.mediaId).toBe(asset.id);
    expect(image.media?.url).toContain('signature=');
    expect(image.props).toMatchObject({ mediaId: asset.id });

    const foreignInput = { categoryId: data.otherCategoryId, name: 'ajena.png', mimeType: 'image/png', sizeBytes: 3 };
    const foreignUpload = (await run(outsider, 'Mutation', 'createMediaUpload', { input: foreignInput })) as { key: string };
    await storage.put(foreignUpload.key, new Uint8Array([1, 2, 3]), 'image/png');
    const foreign = (await run(outsider, 'Mutation', 'registerMedia', { input: { ...foreignInput, key: foreignUpload.key } })) as { id: string };
    await expect(
      run(creator, 'Mutation', 'saveElement', { input: { slideId: slide?.id, component: 'image', mediaId: foreign.id, props: JSON.stringify({ ...defaultsOf('image') }) } }),
    ).rejects.toMatchObject({ errorType: 'ValidationError', message: expect.stringContaining('biblioteca de esta categoría') as string });

    // A gallery keeps one medium per item and none in `props.mediaId`.
    const gallery = (await run(creator, 'Mutation', 'saveElement', {
      input: { slideId: slide?.id, component: 'gallery', props: JSON.stringify(defaultsOf('gallery')) },
    })) as SlideDto['elements'][number];
    expect(gallery).toMatchObject({ mediaId: null, media: null });
    expect(gallery.props).not.toHaveProperty('mediaId');
    const items = [{ mediaId: asset.id, alt: 'Foto', caption: '' }, { mediaId: null, alt: 'Imagen 2', caption: '' }];
    const filled = (await run(creator, 'Mutation', 'saveElement', {
      input: { slideId: slide?.id, id: gallery.id, component: 'gallery', props: JSON.stringify({ items }) },
    })) as SlideDto['elements'][number];
    expect(filled.props).toEqual({ items });
    await expect(
      run(creator, 'Mutation', 'saveElement', {
        input: { slideId: slide?.id, id: gallery.id, component: 'gallery', props: JSON.stringify({ items: [{ ...items[0], mediaId: foreign.id }, items[1]] }) },
      }),
    ).rejects.toMatchObject({ errorType: 'ValidationError', message: expect.stringContaining('biblioteca de esta categoría') as string });
  });

  it('leaves the narration clip failed with the sandbox message and needs a voice to generate', async () => {
    const [slide] = ((await run(creator, 'Query', 'version', { id: version.id })) as DocumentVersionDto).slides;
    const clip = (await run(creator, 'Mutation', 'generateNarration', {
      input: { slideId: slide?.id, script: 'Bienvenidos a la clase.', startsAtS: 0, voice: 'Lupe', speed: 1 },
    })) as { id: string; status: string; errorMessage: string; audioUrl: string | null };
    expect(clip).toMatchObject({ status: 'failed', errorMessage: 'La narración no está disponible en el sandbox', audioUrl: null });

    const retry = (await run(creator, 'Mutation', 'generateNarration', {
      input: { id: clip.id, slideId: slide?.id, script: 'Otra vez.', startsAtS: 1, voice: 'Lupe', speed: 1 },
    })) as { id: string; script: string; status: string };
    expect(retry).toMatchObject({ id: clip.id, script: 'Otra vez.', status: 'failed' });
    const stored = ((await run(creator, 'Query', 'version', { id: version.id })) as DocumentVersionDto).slides.find((candidate) => candidate.id === slide?.id);
    expect(stored?.narrationClips).toHaveLength(1);
    await expect(
      run(creator, 'Mutation', 'generateNarration', { input: { slideId: slide?.id, script: 'x'.repeat(3001), startsAtS: 0, voice: 'Lupe', speed: 1 } }),
    ).rejects.toMatchObject({ errorType: 'ValidationError' });
    await expect(
      run(creator, 'Mutation', 'generateNarration', { input: { slideId: slide?.id, script: 'Sin voz.', startsAtS: 0, voice: null, speed: 1 } }),
    ).rejects.toMatchObject({ errorType: 'ValidationError', message: 'voice: elige una voz de Polly antes de generar la narración.' });
  });

  it('lists the Polly voices and rejects others', async () => {
    const page = (await run(creator, 'Query', 'narrationVoices', { filter: { languageCode: 'es-MX' } })) as { items: unknown[]; nextToken: string | null };
    expect(page).toEqual({ items: [{ id: 'Mia', name: 'Mia', gender: 'female', languageCode: 'es-MX' }, { id: 'Andres', name: 'Andrés', gender: 'male', languageCode: 'es-MX' }], nextToken: null });
    const [slide] = ((await run(creator, 'Query', 'version', { id: version.id })) as DocumentVersionDto).slides;
    await expect(run(creator, 'Mutation', 'saveNarration', { input: { slideId: slide?.id, script: '', startsAtS: 0, voice: 'Robot', speed: 1 } })).rejects.toMatchObject({
      errorType: 'ValidationError',
    });
  });

  it('saves narration clips without synthesizing and deletes them', async () => {
    const [slide] = ((await run(creator, 'Query', 'version', { id: version.id })) as DocumentVersionDto).slides;
    interface Clip {
      id: string;
      script: string;
      status: string;
      speed: number;
      startsAtS: number;
      voice: string | null;
    }
    // A new clip has no voice until the person picks one of Polly's.
    const created = (await run(creator, 'Mutation', 'saveNarration', { input: { slideId: slide?.id, script: '', startsAtS: 2, voice: null, speed: 1 } })) as Clip;
    expect(created).toMatchObject({ script: '', status: 'pending', startsAtS: 2, voice: null });

    // The sandbox leaves a generated clip failed; a new speed or start keeps that outcome, a new script resets it.
    const generated = (await run(creator, 'Mutation', 'generateNarration', {
      input: { id: created.id, slideId: slide?.id, script: 'Hola a todos.', startsAtS: 2, voice: 'Lupe', speed: 1 },
    })) as Clip;
    expect(generated.status).toBe('failed');
    const faster = (await run(creator, 'Mutation', 'saveNarration', {
      input: { id: created.id, slideId: slide?.id, script: 'Hola a todos.', startsAtS: 3, voice: 'Lupe', speed: 2 },
    })) as Clip;
    expect(faster).toMatchObject({ status: 'failed', speed: 2, startsAtS: 3 });
    const rewritten = (await run(creator, 'Mutation', 'saveNarration', {
      input: { id: created.id, slideId: slide?.id, script: 'Hola de nuevo.', startsAtS: 3, voice: 'Lupe', speed: 2 },
    })) as Clip;
    expect(rewritten).toMatchObject({ status: 'pending', script: 'Hola de nuevo.' });

    await expect(
      run(creator, 'Mutation', 'saveNarration', { input: { slideId: slide?.id, script: 'x'.repeat(3001), startsAtS: 0, voice: 'Lupe', speed: 1 } }),
    ).rejects.toMatchObject({ errorType: 'ValidationError' });
    expect(await run(creator, 'Mutation', 'deleteNarration', { narrationClipId: created.id })).toEqual({ id: created.id, deleted: true });
    const stored = ((await run(creator, 'Query', 'version', { id: version.id })) as DocumentVersionDto).slides.find((candidate) => candidate.id === slide?.id);
    expect(stored?.narrationClips.some((clip) => clip.id === created.id)).toBe(false);
  });

  it('serves the component catalog as JSON', async () => {
    // AWSJSON fields are JSON values; AppSync serializes them once for the client.
    const catalog = (await run(creator, 'Query', 'componentCatalog')) as { components: { key: string; propsSchema: unknown; defaults: unknown }[]; slideTypes: { key: string }[] };
    expect(catalog.components).toHaveLength(28);
    expect(catalog.slideTypes).toHaveLength(7);
    for (const component of catalog.components) {
      expect(component.propsSchema).toMatchObject({ type: 'object' });
      expect(componentCatalog.validateProps(component.key, component.defaults).ok).toBe(true);
    }
  });
});

describe('authorization', () => {
  it('rejects a missing identity, a person without role and actions outside the role', async () => {
    await expect(run(null, 'Query', 'categories')).rejects.toMatchObject({ errorType: 'Unauthorized' });
    await expect(claimsOf(data.emails.withoutRole)).rejects.toMatchObject({ reason: 'no_access' });
    expect(await run(viewer, 'Query', 'document', { nodeId: data.classes.lifecycle })).toMatchObject({ nodeId: data.classes.lifecycle });
    await expect(run(viewer, 'Mutation', 'createDocument', { nodeId: data.classes.math })).rejects.toMatchObject({ errorType: 'Unauthorized' });
  });

  it('keeps the records of other categories and subcategories away from the person', async () => {
    const document = (await run(outsider, 'Mutation', 'createDocument', { nodeId: data.classes.other })) as ClassDocumentDto;
    const attempts = [
      ['Query', 'document', { nodeId: data.classes.other }],
      ['Query', 'version', { id: document.editingVersion.id }],
      ['Mutation', 'createVersion', { documentId: document.id }],
      ['Mutation', 'publishVersion', { documentId: document.id }],
      ['Mutation', 'saveSlide', { input: { versionId: document.editingVersion.id, type: 'cover' } }],
      ['Mutation', 'reorderSlides', { versionId: document.editingVersion.id, slideIds: [] }],
    ] as const;
    for (const [type, field, args] of attempts) {
      await expect(run(creator, type, field, args)).rejects.toMatchObject({ errorType: 'Unauthorized' });
    }
    await expect(run(mathCreator, 'Query', 'document', { nodeId: data.classes.lifecycle })).rejects.toMatchObject({ errorType: 'Unauthorized' });
    expect(await run(mathCreator, 'Mutation', 'createDocument', { nodeId: data.classes.math })).toMatchObject({ nodeId: data.classes.math });
  });

  it('answers NotFound for a record that does not exist', async () => {
    await expect(run(creator, 'Query', 'version', { id: '00000000-0000-4000-8000-000000000000' })).rejects.toMatchObject({ errorType: 'NotFound' });
  });
});
