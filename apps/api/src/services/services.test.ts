import { describe, expect, it, vi } from 'vitest';
import type { StudioClaims } from '../auth/index.ts';
import { Logger } from '../shared/log/index.ts';
import type { SpeechSynthesizer } from '../infrastructure/speech/index.ts';
import { UnavailableSpeechSynthesizer } from '../infrastructure/speech/index.ts';
import { MemoryStorage } from '../../test/support/memory-storage.ts';
import { ScriptedDatabase } from '../../test/support/scripted-database.ts';
import { DocumentService } from './document-service.ts';
import { MediaService } from './media-service.ts';
import { NarrationService } from './narration-service.ts';
import { PublishService } from './publish-service.ts';
import { SlideService } from './slide-service.ts';
import { FakeSpeechSynthesizer } from '../../test/support/fake-speech-synthesizer.ts';

const claims: StudioClaims = {
  sub: 'sub-1', email: 'creador@lumia.studio', name: 'Creadora', studio_user_id: 'u1', studio_role: 'content_creator', studio_role_name: 'Creación de contenido',
  studio_actions: [], studio_categories: [], studio_subcategories: [],
};
const ID = '3f2b8f0e-6a1d-4c57-9e1a-2d6a4b0c9f11';
const SLIDE_ID = '7a1c0f55-0b5e-4d0e-8f43-5d1f7c6f2a10';
const NODE_ID = '5d2c1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d';
const CATEGORY_ID = '1b2c3d4e-5f60-4718-9a2b-3c4d5e6f7a80';

const documentRow = {
  id: ID, node_id: NODE_ID, status: 'draft', current_version: 2, published_version: 1, updated_at: '2026-01-01T00:00:00.000Z',
};
const classNode = (kind: 'class' | 'folder'): Record<string, unknown> => ({
  id: NODE_ID, subcategory_id: ID, parent_id: null, kind, name: kind === 'class' ? 'clase-1.lumia' : 'semana-1', display_name: 'Clase 1',
  description: '', position: 1, document_id: null, document_status: null, current_version: null, published_version: null,
});
const versionRow = (status: string, number: number): Record<string, unknown> => ({
  id: ID, document_id: ID, number, status, created_at: '2026-01-01T00:00:00.000Z', created_by: 'sub-1', published_at: null, published_by: null,
});
const ownerRow = (status: string): Record<string, unknown> => ({ version_id: ID, document_id: ID, status, category_id: CATEGORY_ID });
/** Answer to the `for update` lock of the draft version taken inside the writing transaction. */
const lockAnswer = { match: 'for update', rows: [ownerRow('draft')] };
const silent = new Logger({}, { write: () => undefined });

describe('PublishService', () => {
  const documentAnswer = { match: 'from studio.class_document d where d.id', rows: [documentRow] };
  const draftAnswer = (rows: unknown[]) => ({ match: 'order by number desc limit 1', when: (p: Record<string, unknown>) => p.status === 'draft', rows });

  it('requires a draft', async () => {
    const service = new PublishService(new ScriptedDatabase([documentAnswer, draftAnswer([])]), new MemoryStorage());
    await expect(service.publish(claims, ID)).rejects.toMatchObject({ errorType: 'Conflict' });
  });

  it('requires at least one slide', async () => {
    const db = new ScriptedDatabase([documentAnswer, draftAnswer([versionRow('draft', 2)]), lockAnswer, { match: 'count(*)', rows: [{ total: 0 }] }]);
    await expect(new PublishService(db, new MemoryStorage()).publish(claims, ID)).rejects.toMatchObject({
      errorType: 'ValidationError',
      message: expect.stringContaining('al menos una diapositiva') as string,
    });
  });

  it('archives the previous version and publishes the draft in one transaction', async () => {
    const db = new ScriptedDatabase([
      documentAnswer,
      draftAnswer([versionRow('draft', 2)]),
      lockAnswer,
      { match: 'order by number desc limit 1', rows: [versionRow('published', 1)] },
      { match: 'count(*)', rows: [{ total: 3 }] },
      { match: 'from studio.document_version where id', rows: [versionRow('published', 2)] },
      { match: 'order by number', rows: [versionRow('published', 2)] },
    ]);
    await new PublishService(db, new MemoryStorage()).publish(claims, ID);
    expect(db.ran("set status = 'archived'")).toBe(true);
    expect(db.ran("set status = 'published'")).toBe(true);
    expect(db.transactions).toBe(1);
  });
});

describe('DocumentService', () => {
  const nodeAnswer = (kind: 'class' | 'folder') => ({ match: 'from studio.tree_node n', rows: [classNode(kind)] });

  it('rejects a second document for the same class', async () => {
    const db = new ScriptedDatabase([nodeAnswer('class'), { match: 'where d.node_id = :nodeId', rows: [documentRow] }]);
    const service = new DocumentService(db, new MemoryStorage());
    await expect(service.createDocument(claims, NODE_ID)).rejects.toMatchObject({ errorType: 'Conflict' });
  });

  it('answers NotFound for a missing node and ValidationError for a folder', async () => {
    const service = new DocumentService(new ScriptedDatabase(), new MemoryStorage());
    await expect(service.createDocument(claims, NODE_ID)).rejects.toMatchObject({ errorType: 'NotFound' });
    await expect(service.document(NODE_ID)).rejects.toMatchObject({ errorType: 'NotFound' });
    const folder = new DocumentService(new ScriptedDatabase([nodeAnswer('folder')]), new MemoryStorage());
    await expect(folder.createDocument(claims, NODE_ID)).rejects.toMatchObject({ errorType: 'ValidationError' });
  });

  it('returns null when the class has no document', async () => {
    const service = new DocumentService(new ScriptedDatabase([nodeAnswer('class')]), new MemoryStorage());
    await expect(service.document(NODE_ID)).resolves.toBeNull();
  });

  it('creates the document and version 1 inside one transaction', async () => {
    const db = new ScriptedDatabase([
      nodeAnswer('class'),
      { match: 'where d.id = :id', rows: [{ ...documentRow, current_version: 1, published_version: null }] },
      { match: 'order by number desc limit 1', when: (p) => p.status === 'draft', rows: [versionRow('draft', 1)] },
      { match: 'from studio.document_version where id', rows: [versionRow('draft', 1)] },
      { match: 'order by number', rows: [versionRow('draft', 1)] },
    ]);
    const document = await new DocumentService(db, new MemoryStorage()).createDocument(claims, NODE_ID);
    expect(document.nodeId).toBe(NODE_ID);
    expect(db.statements.filter((statement) => statement.sql.includes('insert into studio.class_document'))).toHaveLength(1);
    expect(db.ran('insert into studio.document_version')).toBe(true);
    expect(db.transactions).toBe(1);
  });
});

describe('SlideService', () => {
  const draftOwner = { match: 'from studio.slide s join studio.document_version v', rows: [ownerRow('draft')] };

  it('only edits the draft version', async () => {
    const db = new ScriptedDatabase([{ match: 'from studio.document_version v join studio.class_document', rows: [ownerRow('published')] }]);
    const service = new SlideService(db, new MemoryStorage());
    await expect(service.saveSlide(claims, { versionId: ID, title: 'Portada' })).rejects.toMatchObject({ errorType: 'Conflict' });
    await expect(service.applySlidesDraft(claims, ID, undefined, [])).rejects.toMatchObject({ errorType: 'Conflict' });
    await expect(service.reorderSlides(claims, ID, [])).rejects.toMatchObject({ errorType: 'Conflict' });
    expect(db.ran('insert into')).toBe(false);
  });

  it('creates a slide that advances with a click and accepts every advance mode', async () => {
    const versionOwner = { match: 'from studio.document_version v join studio.class_document', rows: [ownerRow('draft')] };
    const db = new ScriptedDatabase([versionOwner, lockAnswer, { match: 'from studio.slide s', rows: [] }]);
    const service = new SlideService(db, new MemoryStorage());
    await service.saveSlide(claims, { versionId: ID, title: 'Quiz' }).catch(() => undefined);
    const insert = db.statements.find((statement) => statement.sql.includes('insert into studio.slide'));
    expect(insert?.params.advance).toBe('click');
    await service.saveSlide(claims, { versionId: ID, title: 'Quiz', advance: 'on_complete' }).catch(() => undefined);
    expect(db.statements.filter((statement) => statement.sql.includes('insert into studio.slide')).at(-1)?.params.advance).toBe('on_complete');
    await expect(service.saveSlide(claims, { versionId: ID, title: 'Portada', advance: 'never' })).rejects.toMatchObject({ errorType: 'ValidationError' });
  });

  const element = { component: 'title', x: 6, y: 4, w: 88, h: 9, appearsAtS: 0 };

  it('rejects invalid props, geometry and unknown components naming the field', async () => {
    const service = new SlideService(new ScriptedDatabase([draftOwner]), new MemoryStorage());
    const save = (overrides: Record<string, unknown>): Promise<unknown> =>
      service.saveElement(claims, { slideId: SLIDE_ID, props: { text: 'Hola', level: 'h2', align: 'left' }, ...element, ...overrides });
    await expect(save({ props: { text: '', level: 'h2', align: 'left' } })).rejects.toMatchObject({
      errorType: 'ValidationError',
      message: expect.stringContaining('props.text') as string,
    });
    await expect(save({ props: { text: 'x', level: 'h2', align: 'left', extra: 1 } })).rejects.toMatchObject({ errorType: 'ValidationError' });
    await expect(save({ w: 120 })).rejects.toMatchObject({ errorType: 'ValidationError', message: expect.stringContaining('geometry') as string });
    await expect(save({ y: 55, h: 9 })).rejects.toMatchObject({ errorType: 'ValidationError' });
    await expect(save({ component: 'hologram' })).rejects.toMatchObject({
      errorType: 'ValidationError',
      message: expect.stringContaining('component') as string,
    });
  });

  it('validates every element of a draft before writing anything', async () => {
    const db = new ScriptedDatabase([{ match: 'from studio.document_version v join studio.class_document', rows: [ownerRow('draft')] }]);
    const good = { title: 'Portada', elements: [{ ...element, z: 1, props: { text: 'Hola', level: 'h1', align: 'center' } }] };
    const bad = { title: 'Quiz', elements: [{ ...element, z: 1, props: { text: 7 } }] };
    await expect(new SlideService(db, new MemoryStorage()).applySlidesDraft(claims, ID, undefined, [good, bad])).rejects.toMatchObject({
      errorType: 'ValidationError',
      message: expect.stringMatching(/Diapositiva 2, elemento 1.*props\.text/s) as string,
    });
    expect(db.ran('insert into')).toBe(false);
  });

  it('requires the exact set of slides to reorder', async () => {
    const db = new ScriptedDatabase([
      { match: 'from studio.document_version v join studio.class_document', rows: [ownerRow('draft')] },
      { match: 'order by position', rows: [{ id: SLIDE_ID }] },
    ]);
    await expect(new SlideService(db, new MemoryStorage()).reorderSlides(claims, ID, [ID])).rejects.toMatchObject({ errorType: 'ValidationError' });
    await expect(new SlideService(db, new MemoryStorage()).reorderSlides(claims, ID, [SLIDE_ID, SLIDE_ID])).rejects.toMatchObject({
      errorType: 'ValidationError',
    });
  });
});

describe('NarrationService', () => {
  const draftOwner = { match: 'from studio.slide s join studio.document_version v', rows: [ownerRow('draft')] };
  const request = { slideId: SLIDE_ID, script: 'Hola clase.', startsAtS: 0, voice: 'Lupe', speed: 1 };
  const clipRow = {
    id: ID, slide_id: SLIDE_ID, starts_at_s: 0, script: 'Hola clase.', voice: 'Lupe', speed: 1, generated_duration_s: 0,
    audio_key: null, speech_marks_key: null, status: 'failed', error_message: null,
  };

  it('stores the failure on the clip and returns it', async () => {
    const db = new ScriptedDatabase([draftOwner, lockAnswer, { match: 'from studio.narration_clip n', rows: [clipRow] }]);
    await new NarrationService(db, new MemoryStorage(), new FakeSpeechSynthesizer(), silent).generate(claims, request);
    const failed = db.statements.find((s) => s.sql.includes("status = 'failed'"));
    expect(failed?.params.message).toBe('La narración no está disponible en el sandbox');
  });

  it('hides unexpected failure details', async () => {
    const speech: SpeechSynthesizer = { synthesize: vi.fn().mockRejectedValue(new Error('secret=1')), voices: () => new FakeSpeechSynthesizer().voices() };
    const db = new ScriptedDatabase([draftOwner, lockAnswer, { match: 'from studio.narration_clip n', rows: [clipRow] }]);
    await new NarrationService(db, new MemoryStorage(), speech, silent).generate(claims, request);
    expect(db.statements.find((s) => s.sql.includes("status = 'failed'"))?.params.message).toBe('No se pudo generar la narración.');
  });

  it('stores audio and speech marks under the documented keys', async () => {
    const storage = new MemoryStorage();
    const speech: SpeechSynthesizer = {
      synthesize: () => Promise.resolve({ audio: new Uint8Array([1]), speechMarks: '{"time":0}', durationS: 4.2 }),
      voices: () => new FakeSpeechSynthesizer().voices(),
    };
    const db = new ScriptedDatabase([draftOwner, lockAnswer, { match: 'from studio.narration_clip n', rows: [{ ...clipRow, status: 'ready' }] }]);
    await new NarrationService(db, storage, speech, silent).generate(claims, request);
    const keys = [...storage.objects.keys()];
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(/^narration\/[0-9a-f-]+\/[0-9a-f-]+\.mp3$/);
    expect(keys[1]).toMatch(/\.marks\.json$/);
    expect(db.statements.find((s) => s.sql.includes("status = 'ready'"))?.params.durationS).toBe(4.2);
  });

  it('lists the Polly voices by language prefix, in pages', async () => {
    const service = new NarrationService(new ScriptedDatabase(), new MemoryStorage(), new FakeSpeechSynthesizer(), silent);
    const mexican = await service.voices({ languageCode: 'es-mx' });
    expect(mexican).toEqual({ items: [{ id: 'Mia', name: 'Mia', gender: 'female', languageCode: 'es-MX' }, { id: 'Andres', name: 'Andrés', gender: 'male', languageCode: 'es-MX' }], nextToken: null });
    const first = await service.voices({ languageCode: 'es', limit: 2 });
    expect(first.items.map((voice) => voice.id)).toEqual(['Lupe', 'Mia']);
    const rest = await service.voices({ languageCode: 'es', limit: 2, ...(first.nextToken === null ? {} : { nextToken: first.nextToken }) });
    expect(rest).toEqual({ items: [{ id: 'Andres', name: 'Andrés', gender: 'male', languageCode: 'es-MX' }], nextToken: null });
  });

  it('offers no voices when Polly is unreachable, and says so', async () => {
    const service = new NarrationService(new ScriptedDatabase(), new MemoryStorage(), new UnavailableSpeechSynthesizer(), silent);
    await expect(service.voices({})).rejects.toMatchObject({ errorType: 'InternalError', message: 'Polly no está disponible en el sandbox: no hay voces para elegir.' });
    const failing: SpeechSynthesizer = { synthesize: vi.fn(), voices: vi.fn().mockRejectedValue(new Error('ExpiredToken secret')) };
    await expect(new NarrationService(new ScriptedDatabase(), new MemoryStorage(), failing, silent).voices({}))
      .rejects.toMatchObject({ errorType: 'InternalError', message: 'No se pudo consultar las voces de Polly.' });
  });

  it('needs a voice to generate and rejects one that Polly does not offer', async () => {
    const service = new NarrationService(new ScriptedDatabase([draftOwner]), new MemoryStorage(), new FakeSpeechSynthesizer(), silent);
    await expect(service.generate(claims, { ...request, voice: null })).rejects.toMatchObject({ errorType: 'ValidationError', message: 'voice: elige una voz de Polly antes de generar la narración.' });
    await expect(service.generate(claims, { ...request, voice: 'Penelope' })).rejects.toMatchObject({ errorType: 'ValidationError', message: 'voice: no es una voz disponible en Polly.' });
  });

  it('rejects scripts over 3000 characters', async () => {
    const service = new NarrationService(new ScriptedDatabase([draftOwner]), new MemoryStorage(), new FakeSpeechSynthesizer(), silent);
    await expect(service.generate(claims, { ...request, script: 'a'.repeat(3001) })).rejects.toMatchObject({ errorType: 'ValidationError' });
  });
});

describe('MediaService', () => {
  it('reserves a key under media/<category>/<id>/ with a sanitized file name', async () => {
    const upload = await new MediaService(new ScriptedDatabase(), new MemoryStorage()).createUpload({
      categoryId: CATEGORY_ID, name: '../mi imagen.png', mimeType: 'image/png', sizeBytes: 10,
    });
    expect(upload.key).toMatch(new RegExp(`^media/${CATEGORY_ID}/[0-9a-f-]{36}/[^/]+$`));
    expect(upload.key).not.toContain('..');
    expect(upload.uploadUrl).toContain(upload.key);
  });

  it('refuses to register an object that was not uploaded, a foreign key or a key of another category', async () => {
    const service = new MediaService(new ScriptedDatabase(), new MemoryStorage());
    const base = { categoryId: CATEGORY_ID, name: 'a.png', mimeType: 'image/png', sizeBytes: 10 };
    await expect(service.register(claims, { ...base, key: `media/${CATEGORY_ID}/${ID}/a.png` })).rejects.toMatchObject({ errorType: 'ValidationError' });
    await expect(service.register(claims, { ...base, key: 'narration/x/y.mp3' })).rejects.toMatchObject({ errorType: 'ValidationError' });
    await expect(service.register(claims, { ...base, key: `media/${NODE_ID}/${ID}/a.png` })).rejects.toMatchObject({
      message: 'key: la llave no corresponde a una subida de medios de esta categoría.',
    });
  });
});
