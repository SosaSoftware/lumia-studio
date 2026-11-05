import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { S3ObjectStorage } from './s3-object-storage.ts';

type Presign = (client: S3Client, command: PutObjectCommand | GetObjectCommand, options: { expiresIn: number }) => Promise<string>;

function setup(send: (command: unknown) => Promise<unknown>): {
  storage: S3ObjectStorage;
  presign: Mock<Presign>;
} {
  const client = { send: vi.fn(send) } as unknown as S3Client;
  const presign = vi.fn<Presign>(() => Promise.resolve('https://signed'));
  return { storage: new S3ObjectStorage(client, 'bucket', presign), presign };
}

describe('S3ObjectStorage', () => {
  it('presigns upload and download URLs', async () => {
    const { storage, presign } = setup(() => Promise.resolve({}));
    expect(await storage.createUploadUrl('k', 'image/png', 60)).toBe('https://signed');
    expect(await storage.createDownloadUrl('k', 30)).toBe('https://signed');
    const upload = presign.mock.calls[0]?.[1];
    expect(upload).toBeInstanceOf(PutObjectCommand);
    expect(upload?.input).toMatchObject({ Bucket: 'bucket', Key: 'k', ContentType: 'image/png' });
    expect(presign.mock.calls[0]?.[2]).toEqual({ expiresIn: 60 });
    expect(presign.mock.calls[1]?.[1]).toBeInstanceOf(GetObjectCommand);
  });

  it('puts and gets objects', async () => {
    const sent: unknown[] = [];
    const { storage } = setup((command) => {
      sent.push(command);
      return Promise.resolve(
        command instanceof GetObjectCommand ? { Body: { transformToByteArray: () => Promise.resolve(new Uint8Array([1, 2])) } } : {},
      );
    });
    await storage.put('k', 'x', 'text/plain');
    expect(sent[0]).toBeInstanceOf(PutObjectCommand);
    expect(await storage.get('k')).toEqual(new Uint8Array([1, 2]));
  });

  it('maps missing objects', async () => {
    const missing = Object.assign(new Error('x'), { name: 'NoSuchKey' });
    const { storage } = setup(async () => Promise.reject(missing));
    await expect(storage.get('k')).rejects.toMatchObject({ errorType: 'NotFound' });
    expect(await storage.exists('k')).toBe(false);
  });

  it('exists is true when HEAD succeeds and rethrows other errors', async () => {
    const ok = setup(async (command) => (command instanceof HeadObjectCommand ? {} : Promise.reject(new Error('no'))));
    expect(await ok.storage.exists('k')).toBe(true);
    const bad = setup(async () => Promise.reject(new Error('denied')));
    await expect(bad.storage.exists('k')).rejects.toThrow('denied');
  });
});
