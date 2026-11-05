import { randomUUID } from 'node:crypto';
import type { StudioClaims } from '../auth/index.ts';
import type { Database } from '../infrastructure/db/index.ts';
import { AppError } from '../shared/errors/index.ts';
import type { ObjectStorage } from '../infrastructure/storage/index.ts';
import type { MediaAssetDto } from '../domain/dto.ts';
import type { MediaRecord } from '../repositories/media-repository.ts';
import { DOWNLOAD_URL_TTL_S } from '../repositories/version-reader.ts';
import { decodeOffset, encodeOffset } from '../support/offset-token.ts';
import { StudioService } from './studio-service.ts';

export interface MediaUploadRequest {
  /** Category whose library receives the file. */
  categoryId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

export interface RegisterMediaRequest extends MediaUploadRequest {
  key: string;
}

export interface MediaUploadDto {
  key: string;
  uploadUrl: string;
  expiresAt: string;
}

export interface MediaPageDto {
  items: MediaAssetDto[];
  nextToken: string | null;
}

export interface MediaSearch {
  categoryId: string;
  mimePrefix?: string;
  text?: string;
  limit?: number;
  nextToken?: string;
}

/** Lifetime of an upload URL. */
export const UPLOAD_URL_TTL_S = 300;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const MAX_NAME_LENGTH = 255;
const MIME_TYPE = /^[A-Za-z0-9][\w.+-]*\/[A-Za-z0-9][\w.+-]*$/;
/** `media/<category id>/<asset id>/<file name>`. */
const MEDIA_KEY = /^media\/([0-9a-f-]{36})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[^/]+$/;

/** Media uploads and the media library of each category. */
export class MediaService extends StudioService {
  public constructor(db: Database, storage: ObjectStorage) {
    super(db, storage);
  }

  /** Reserves the object key and returns a signed URL for the browser to upload to. */
  public async createUpload(request: MediaUploadRequest): Promise<MediaUploadDto> {
    MediaService.validate(request);
    const key = `media/${request.categoryId}/${randomUUID()}/${MediaService.safeFileName(request.name)}`;
    const uploadUrl = await this.storage.createUploadUrl(key, request.mimeType, UPLOAD_URL_TTL_S);
    return { key, uploadUrl, expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_S * 1000).toISOString() };
  }

  /** Records an uploaded object; registering the same key twice returns the same asset. */
  public async register(claims: StudioClaims, request: RegisterMediaRequest): Promise<MediaAssetDto> {
    MediaService.validate(request);
    const match = MEDIA_KEY.exec(request.key);
    const assetId = match?.[2];
    if (assetId === undefined || match?.[1] !== request.categoryId) {
      throw AppError.validation('key: la llave no corresponde a una subida de medios de esta categoría.');
    }
    const existing = await this.repos.media.findByKey(request.key);
    if (existing !== null) {
      return this.toDto(existing);
    }
    if (!(await this.storage.exists(request.key))) {
      throw AppError.validation('key: el archivo todavía no se ha subido.');
    }
    await this.repos.media.insert(
      { id: assetId, categoryId: request.categoryId, key: request.key, mimeType: request.mimeType, name: request.name, sizeBytes: request.sizeBytes },
      claims.sub,
    );
    const created = await this.repos.media.find(assetId);
    if (created === null) {
      throw AppError.internal('No se pudo registrar el medio.');
    }
    return this.toDto(created);
  }

  public async library(search: MediaSearch): Promise<MediaPageDto> {
    const limit = Math.min(Math.max(search.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const offset = decodeOffset(search.nextToken);
    const rows = await this.repos.media.search({
      categoryId: search.categoryId,
      mimePrefix: search.mimePrefix ?? '',
      text: search.text ?? '',
      limit: limit + 1,
      offset,
    });
    const page = rows.slice(0, limit);
    return {
      items: await Promise.all(page.map((row) => this.toDto(row))),
      nextToken: rows.length > limit ? encodeOffset(offset + limit) : null,
    };
  }

  private async toDto(record: MediaRecord): Promise<MediaAssetDto> {
    return {
      id: record.id,
      name: record.name,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      url: await this.storage.createDownloadUrl(record.key, DOWNLOAD_URL_TTL_S),
      createdAt: record.createdAt,
    };
  }

  private static validate(request: MediaUploadRequest): void {
    if (request.name.trim() === '' || request.name.length > MAX_NAME_LENGTH) {
      throw AppError.validation(`name: debe tener entre 1 y ${String(MAX_NAME_LENGTH)} caracteres.`);
    }
    if (!MIME_TYPE.test(request.mimeType)) {
      throw AppError.validation('mimeType: no es un tipo de archivo válido.');
    }
    if (!Number.isInteger(request.sizeBytes) || request.sizeBytes <= 0) {
      throw AppError.validation('sizeBytes: debe ser un entero mayor que cero.');
    }
  }

  private static safeFileName(name: string): string {
    const cleaned = name.trim().replace(/[^\p{L}\p{N}._-]+/gu, '_').replace(/^\.+/, '');
    return cleaned === '' ? 'file' : cleaned;
  }
}
