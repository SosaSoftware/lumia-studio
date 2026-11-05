import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '../../shared/errors/index.ts';
import type { ObjectStorage } from './object-storage.ts';

export interface FileSystemObjectStorageOptions {
  /** Directory that holds the objects. */
  root: string;
  /** Public base URL of the server that serves `/storage/*`. */
  baseUrl: string;
  signingSecret: string;
  /** Clock in epoch seconds; injectable for tests. */
  now?: () => number;
}

/** Sandbox storage: objects on disk, access through HMAC-signed, expiring URLs. */
export class FileSystemObjectStorage implements ObjectStorage {
  private readonly root: string;
  private readonly baseUrl: string;
  private readonly secret: string;
  private readonly now: () => number;

  public constructor(options: FileSystemObjectStorageOptions) {
    if (options.signingSecret.length < 16) {
      throw AppError.internal('LUMIA_STORAGE_SIGNING_SECRET must have at least 16 characters.');
    }
    this.root = path.resolve(options.root);
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.secret = options.signingSecret;
    this.now = options.now ?? ((): number => Math.floor(Date.now() / 1000));
  }

  public createUploadUrl(key: string, _contentType: string, expiresInS: number): Promise<string> {
    return this.deferred(() => this.signedUrl('PUT', key, expiresInS));
  }

  public createDownloadUrl(key: string, expiresInS: number): Promise<string> {
    return this.deferred(() => this.signedUrl('GET', key, expiresInS));
  }

  public async put(key: string, body: Uint8Array | string): Promise<void> {
    const file = this.resolvePath(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  }

  public async get(key: string): Promise<Uint8Array> {
    const file = this.resolvePath(key);
    try {
      return new Uint8Array(await readFile(file));
    } catch (error) {
      if (FileSystemObjectStorage.isMissing(error)) {
        throw AppError.notFound('El archivo no existe.');
      }
      throw error;
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      return (await stat(this.resolvePath(key))).isFile();
    } catch (error) {
      if (FileSystemObjectStorage.isMissing(error)) {
        return false;
      }
      throw error;
    }
  }

  /** Checks a request received by the sandbox server: valid key, not expired, authentic signature. */
  public verifySignedRequest(method: string, key: string, expires: number, signature: string): boolean {
    if (!Number.isFinite(expires) || expires < this.now()) {
      return false;
    }
    try {
      this.resolvePath(key);
    } catch {
      // A key that escapes the root can never carry a valid signature.
      return false;
    }
    const expected = Buffer.from(this.sign(method, key, expires), 'hex');
    const actual = Buffer.from(signature, 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  /** Turns synchronous failures (invalid keys) into rejected promises. */
  private deferred(build: () => string): Promise<string> {
    try {
      return Promise.resolve(build());
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error('Unexpected storage failure'));
    }
  }

  private signedUrl(method: string, key: string, expiresInS: number): string {
    this.resolvePath(key);
    const expires = this.now() + Math.floor(expiresInS);
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    return `${this.baseUrl}/storage/${encodedKey}?expires=${String(expires)}&signature=${this.sign(method, key, expires)}`;
  }

  private sign(method: string, key: string, expires: number): string {
    return createHmac('sha256', this.secret).update(`${method.toUpperCase()}\n${key}\n${String(expires)}`).digest('hex');
  }

  /** Resolves a key inside the root; rejects anything that could escape it. */
  private resolvePath(key: string): string {
    const segments = key.split('/');
    if (key === '' || key.includes('\0') || key.includes('\\') || segments.some((s) => s === '' || s === '.' || s === '..')) {
      throw AppError.validation('La llave del archivo no es válida.');
    }
    const resolved = path.resolve(this.root, ...segments);
    if (!resolved.startsWith(this.root + path.sep)) {
      throw AppError.validation('La llave del archivo no es válida.');
    }
    return resolved;
  }

  private static isMissing(error: unknown): boolean {
    return error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR');
  }
}
