import { AppError } from '../../src/shared/errors/index.ts';
import type { ObjectStorage } from '../../src/infrastructure/storage/index.ts';

/** In-memory `ObjectStorage` for tests. */
export class MemoryStorage implements ObjectStorage {
  public readonly objects = new Map<string, Uint8Array>();

  public createUploadUrl(key: string): Promise<string> {
    return Promise.resolve(`memory://upload/${key}`);
  }

  public createDownloadUrl(key: string): Promise<string> {
    return Promise.resolve(`memory://download/${key}`);
  }

  public put(key: string, body: Uint8Array | string): Promise<void> {
    this.objects.set(key, typeof body === 'string' ? new TextEncoder().encode(body) : body);
    return Promise.resolve();
  }

  public get(key: string): Promise<Uint8Array> {
    const body = this.objects.get(key);
    return body === undefined ? Promise.reject(AppError.notFound('El archivo no existe.')) : Promise.resolve(body);
  }

  public exists(key: string): Promise<boolean> {
    return Promise.resolve(this.objects.has(key));
  }
}
