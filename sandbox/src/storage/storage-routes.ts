import path from 'node:path';
import { AppError } from '@lumia/api/errors';
import type { FileSystemObjectStorage } from '@lumia/api/storage';

export interface StorageResponse {
  status: number;
  contentType?: string;
  body?: Uint8Array | string;
}

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.json': 'application/json',
  '.vtt': 'text/vtt',
};

/** Signed file routes: `GET` and `PUT /storage/<key>?expires=&signature=`. */
export class StorageRoutes {
  public constructor(private readonly storage: FileSystemObjectStorage) {}

  /** @param url Request URL; its pathname starts with `/storage/`. */
  public async handle(method: string, url: URL, body: () => Promise<Uint8Array>): Promise<StorageResponse> {
    if (method !== 'GET' && method !== 'PUT') {
      return { status: 405 };
    }
    const key = StorageRoutes.keyOf(url);
    const expires = Number(url.searchParams.get('expires'));
    const signature = url.searchParams.get('signature') ?? '';
    if (key === null || !this.storage.verifySignedRequest(method, key, expires, signature)) {
      return { status: 403, contentType: 'text/plain; charset=utf-8', body: 'Firma inválida o vencida.' };
    }
    if (method === 'PUT') {
      await this.storage.put(key, await body());
      return { status: 200 };
    }
    try {
      const content = await this.storage.get(key);
      return { status: 200, contentType: CONTENT_TYPES[path.extname(key).toLowerCase()] ?? 'application/octet-stream', body: content };
    } catch (error) {
      if (error instanceof AppError && error.errorType === 'NotFound') {
        return { status: 404, contentType: 'text/plain; charset=utf-8', body: error.message };
      }
      throw error;
    }
  }

  private static keyOf(url: URL): string | null {
    try {
      return url.pathname.slice('/storage/'.length).split('/').map(decodeURIComponent).join('/');
    } catch {
      // A malformed escape sequence cannot belong to a key the server signed.
      return null;
    }
  }
}
