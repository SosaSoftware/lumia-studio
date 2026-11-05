import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ObjectStorage } from './object-storage.ts';
import { FileSystemObjectStorage } from './file-system-object-storage.ts';

describe('FileSystemObjectStorage', () => {
  let root: string;
  let clock = 1_000_000;
  let storage: FileSystemObjectStorage & ObjectStorage;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'lumia-storage-'));
    clock = 1_000_000;
    storage = new FileSystemObjectStorage({
      root, baseUrl: 'http://localhost:4000/', signingSecret: 'storage-secret-long-enough', now: () => clock,
    });
  });
  afterEach(async () => rm(root, { recursive: true, force: true }));

  const parse = (url: string): { key: string; expires: number; signature: string } => {
    const u = new URL(url);
    return {
      key: decodeURIComponent(u.pathname.replace('/storage/', '')),
      expires: Number(u.searchParams.get('expires')),
      signature: u.searchParams.get('signature') ?? '',
    };
  };

  it('puts, gets and checks objects', async () => {
    await storage.put('media/a/b.txt', 'hola', 'text/plain');
    expect(await storage.exists('media/a/b.txt')).toBe(true);
    expect(await storage.exists('media/none')).toBe(false);
    expect(new TextDecoder().decode(await storage.get('media/a/b.txt'))).toBe('hola');
    await expect(storage.get('media/none')).rejects.toMatchObject({ errorType: 'NotFound' });
  });

  it('builds URLs with expiry and verifies a valid signature', async () => {
    const url = await storage.createDownloadUrl('media/a.png', 60);
    expect(url.startsWith('http://localhost:4000/storage/media/a.png?expires=1000060&signature=')).toBe(true);
    const { key, expires, signature } = parse(url);
    expect(storage.verifySignedRequest('GET', key, expires, signature)).toBe(true);
  });

  it('includes the method in the signature', async () => {
    const { key, expires, signature } = parse(await storage.createUploadUrl('media/a.png', 'image/png', 60));
    expect(storage.verifySignedRequest('PUT', key, expires, signature)).toBe(true);
    expect(storage.verifySignedRequest('GET', key, expires, signature)).toBe(false);
  });

  it('rejects tampered key, expiry and signature', async () => {
    const { key, expires, signature } = parse(await storage.createDownloadUrl('media/a.png', 60));
    expect(storage.verifySignedRequest('GET', 'media/b.png', expires, signature)).toBe(false);
    expect(storage.verifySignedRequest('GET', key, expires + 1000, signature)).toBe(false);
    expect(storage.verifySignedRequest('GET', key, expires, 'zz')).toBe(false);
    expect(storage.verifySignedRequest('GET', key, expires, `${signature.slice(0, -2)}00`)).toBe(false);
  });

  it('rejects expired signatures', async () => {
    const { key, expires, signature } = parse(await storage.createDownloadUrl('media/a.png', 60));
    clock += 61;
    expect(storage.verifySignedRequest('GET', key, expires, signature)).toBe(false);
  });

  it('blocks path traversal', async () => {
    for (const key of ['../x', 'a/../../x', '/etc/passwd', 'a//b', 'a\\b', '']) {
      await expect(storage.put(key, 'x', 'text/plain')).rejects.toMatchObject({ errorType: 'ValidationError' });
      await expect(storage.createDownloadUrl(key, 60)).rejects.toMatchObject({ errorType: 'ValidationError' });
      expect(storage.verifySignedRequest('GET', key, clock + 60, 'ab')).toBe(false);
    }
  });
});
