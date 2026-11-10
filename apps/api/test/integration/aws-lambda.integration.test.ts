import { strFromU8, unzipSync } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { componentCatalog } from '@lumia/packages/catalog';
import { createDatabase } from '../../src/infrastructure/db/index.ts';
import type { CloseableDatabase } from '../../src/infrastructure/db/index.ts';
import type { PublishedStore } from '../../src/infrastructure/storage/index.ts';
import { appSyncHandler } from '../../src/lambda/appsync.ts';
import type { AppSyncLambdaResult } from '../../src/lambda/appsync.ts';
import { StudioRuntime } from '../../src/runtime/index.ts';
import { ExportService } from '../../src/services/index.ts';
import type { ExportQueue } from '../../src/services/index.ts';
import { Logger } from '../../src/shared/log/index.ts';
import { FakeSpeechSynthesizer } from '../support/fake-speech-synthesizer.ts';
import { MemoryStorage } from '../support/memory-storage.ts';
import { TreeFixture } from '../support/tree-fixture.ts';
import type { TreeFixtureData } from '../support/tree-fixture.ts';

// The Lambda entry points of AppSync against the sandbox Postgres, with the token claims Cognito gives AppSync.
let admin: CloseableDatabase;
let studioDb: CloseableDatabase;
let fixture: TreeFixture;
let data: TreeFixtureData;
let runtime: StudioRuntime;
const storage = new MemoryStorage();
const requested: string[] = [];
const queue: ExportQueue = {
  enabled: true,
  request: (versionId) => {
    requested.push(versionId);
    return Promise.resolve();
  },
};

class MemoryPublishedStore implements PublishedStore {
  public readonly objects = new Map<string, Uint8Array>();

  public put(key: string, body: Uint8Array): Promise<{ versionId: string | null }> {
    this.objects.set(key, body);
    return Promise.resolve({ versionId: `v${String(this.objects.size)}` });
  }
}

type Json = Record<string, unknown>;

function json(value: unknown): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`Expected an object, got ${JSON.stringify(value)}`);
  return { ...value };
}

/** Calls a Lambda as AppSync does: Cognito token claims (access token with the email added by the trigger). */
function call(handler: string, email: string, type: 'Query' | 'Mutation', field: string, args: Json = {}): Promise<AppSyncLambdaResult> {
  return appSyncHandler(handler, () => runtime)({
    arguments: args,
    identity: { sub: `cognito-${email}`, claims: { sub: `cognito-${email}`, email, client_id: 'web-client', token_use: 'access' } },
    source: null,
    info: { parentTypeName: type, fieldName: field },
  });
}

async function dataOf(result: Promise<AppSyncLambdaResult>): Promise<Json> {
  const answer = await result;
  if (!('data' in answer)) throw new Error(`Expected data, got ${JSON.stringify(answer)}`);
  return json(answer.data);
}

beforeAll(async () => {
  admin = createDatabase('admin');
  studioDb = createDatabase('studio_app');
  fixture = new TreeFixture(admin, 'itest-lambda');
  data = await fixture.create();
  runtime = new StudioRuntime(studioDb, storage, new FakeSpeechSynthesizer(), new Logger({}, { write: () => undefined }), queue);
  StudioRuntime.use(runtime);
});

afterAll(async () => {
  StudioRuntime.use(undefined);
  await fixture.remove();
  await Promise.all([admin.close(), studioDb.close()]);
});

describe('AppSync Lambda entry points', () => {
  it('reads the access of the person from the database; the token only identifies them', async () => {
    expect(await dataOf(call('tree', data.emails.viewer, 'Query', 'me'))).toMatchObject({ email: data.emails.viewer, actions: ['documents.view'] });
  });

  it('answers errors as data with their type, for the resolver to raise them', async () => {
    expect(await call('documents', data.emails.viewer, 'Mutation', 'createDocument', { nodeId: data.classes.lifecycle })).toEqual({
      error: { type: 'Unauthorized', message: 'No tienes permiso para realizar esta acción.' },
    });
    expect(await call('tree', 'nadie@itest-lambda.test', 'Query', 'me')).toMatchObject({ error: { type: 'Unauthorized' } });
    expect(await call('tree', data.emails.creator, 'Mutation', 'createDocument', { nodeId: data.classes.lifecycle })).toEqual({
      error: { type: 'InternalError', message: 'Operación no disponible.' },
    });
  });

  it('starts the export when publishing, and the export writes the .lumia with its key in the version', async () => {
    const creator = data.emails.creator;
    const input = { categoryId: data.categoryId, name: 'robot.png', mimeType: 'image/png', sizeBytes: 3 };
    const upload = await dataOf(call('media', creator, 'Mutation', 'createMediaUpload', { input }));
    await storage.put(String(upload.key), new Uint8Array([1, 2, 3]));
    const asset = await dataOf(call('media', creator, 'Mutation', 'registerMedia', { input: { ...input, key: upload.key } }));

    const document = await dataOf(call('documents', creator, 'Mutation', 'createDocument', { nodeId: data.classes.lifecycle }));
    const versionId = String(json(document.editingVersion).id);
    const image = { component: 'image', x: 10, y: 10, w: 40, h: 30, z: 1, appearsAtS: 0, props: JSON.stringify({ ...json(componentCatalog.get('image')?.defaults), mediaId: asset.id }) };
    await call('documents', creator, 'Mutation', 'applySlidesDraft', { versionId, afterPosition: null, slides: [{ title: 'Portada', elements: [image] }] });
    const published = await dataOf(call('publish', creator, 'Mutation', 'publishVersion', { documentId: document.id }));
    expect(published.status).toBe('published');
    expect(requested).toEqual([versionId]);
    const pending = await admin.query<{ export_status: string | null }>('select export_status from studio.document_version where id = :id::uuid', { id: versionId });
    expect(pending[0]?.export_status).toBe('pending');

    const store = new MemoryPublishedStore();
    const result = await new ExportService(studioDb, storage, store).export(versionId);
    const key = 'itest-lambda/inteligencia-artificial/primero/ciclo-de-vida.lumia';
    expect(result).toEqual({ key, objectVersion: 'v1' });
    const files = unzipSync(store.objects.get(key) ?? new Uint8Array());
    const definition = json(JSON.parse(strFromU8(files['definition.json'] ?? new Uint8Array())));
    expect(definition).toMatchObject({ format: 'lumia', class: { name: 'ciclo-de-vida.lumia' }, version: { number: 1 } });
    const mediaPath = String(json(json(definition.media)[String(asset.id)]).path);
    expect([...(files[mediaPath] ?? [])]).toEqual([1, 2, 3]);
    const [row] = await admin.query<{ export_status: string; export_key: string; export_object_version: string }>(
      'select export_status, export_key, export_object_version from studio.document_version where id = :id::uuid',
      { id: versionId },
    );
    expect(row).toEqual({ export_status: 'ready', export_key: key, export_object_version: 'v1' });
  });
});
