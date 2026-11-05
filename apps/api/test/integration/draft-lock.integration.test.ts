import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ClaimsBuilder } from '../../src/auth/index.ts';
import type { StudioClaims } from '../../src/auth/index.ts';
import { createDatabase } from '../../src/infrastructure/db/index.ts';
import type { CloseableDatabase } from '../../src/infrastructure/db/index.ts';
import { FileSystemObjectStorage } from '../../src/infrastructure/storage/index.ts';
import type { ObjectStorage } from '../../src/infrastructure/storage/index.ts';
import { DocumentService } from '../../src/services/document-service.ts';
import { PublishService } from '../../src/services/publish-service.ts';
import { SlideService } from '../../src/services/slide-service.ts';
import { TreeFixture } from '../support/tree-fixture.ts';
import type { TreeFixtureData } from '../support/tree-fixture.ts';

const HOLD_MS = 300;

let admin: CloseableDatabase;
let studioDb: CloseableDatabase;
let storageRoot: string;
let storage: ObjectStorage;
let fixture: TreeFixture;
let data: TreeFixtureData;
let creator: StudioClaims;
let documents: DocumentService;
let slides: SlideService;
let publisher: PublishService;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Resolves to `true` when the promise settles within `ms`. */
async function settlesWithin(promise: Promise<unknown>, ms: number): Promise<boolean> {
  const settled = promise.then(
    () => true,
    () => true,
  );
  return Promise.race([settled, sleep(ms).then(() => false)]);
}

/** Creates the document of a fixture class with one slide in draft. */
async function draftWithOneSlide(nodeId: string): Promise<{ documentId: string; versionId: string }> {
  const document = await documents.createDocument(creator, nodeId);
  await slides.saveSlide(creator, { versionId: document.editingVersion.id, type: 'cover', title: 'Uno' });
  return { documentId: document.id, versionId: document.editingVersion.id };
}

beforeAll(async () => {
  admin = createDatabase('admin');
  studioDb = createDatabase('studio_app');
  fixture = new TreeFixture(admin, 'itest-lock');
  data = await fixture.create();
  storageRoot = await mkdtemp(path.join(tmpdir(), 'lumia-lock-'));
  storage = new FileSystemObjectStorage({ root: storageRoot, baseUrl: 'http://localhost:4000', signingSecret: 'test-signing-secret-0123456789' });
  creator = await new ClaimsBuilder(studioDb).build(data.emails.creator, 'test-creator');
  documents = new DocumentService(studioDb, storage);
  slides = new SlideService(studioDb, storage);
  publisher = new PublishService(studioDb, storage);
});

afterAll(async () => {
  await fixture.remove();
  await Promise.all([admin.close(), studioDb.close()]);
  await rm(storageRoot, { recursive: true, force: true });
});

describe('draft-only rule under concurrency', () => {
  it('rejects an edit that waits behind a publish', async () => {
    const { versionId } = await draftWithOneSlide(data.classes.lifecycle);
    let edit: Promise<unknown> | undefined;

    await studioDb.transaction(async (tx) => {
      await tx.query('select id from studio.document_version where id = :id::uuid for update', { id: versionId });
      edit = slides.saveSlide(creator, { versionId, type: 'cover', title: 'Tarde' });
      edit.catch(() => undefined);
      // The edit must be waiting for the row lock, not writing.
      expect(await settlesWithin(edit, HOLD_MS)).toBe(false);
      await tx.execute("update studio.document_version set status = 'published' where id = :id::uuid", { id: versionId });
    });

    await expect(edit).rejects.toMatchObject({ errorType: 'Conflict' });
    const rows = await admin.query<{ total: number }>(
      'select count(*)::int as total from studio.slide where version_id = :id::uuid',
      { id: versionId },
    );
    expect(rows[0]?.total).toBe(1);
  });

  it('counts the slides of a publish inside its transaction', async () => {
    const { documentId, versionId } = await draftWithOneSlide(data.classes.editing);
    let publish: Promise<unknown> | undefined;

    await studioDb.transaction(async (tx) => {
      await tx.query('select id from studio.document_version where id = :id::uuid for update', { id: versionId });
      publish = publisher.publish(creator, documentId);
      publish.catch(() => undefined);
      expect(await settlesWithin(publish, HOLD_MS)).toBe(false);
      await tx.execute('delete from studio.slide where version_id = :id::uuid', { id: versionId });
    });

    await expect(publish).rejects.toMatchObject({ errorType: 'ValidationError' });
    const rows = await admin.query<{ status: string }>('select status::text as status from studio.document_version where id = :id::uuid', {
      id: versionId,
    });
    expect(rows[0]?.status).toBe('draft');
  });
});
