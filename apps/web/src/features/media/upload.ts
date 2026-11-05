import { ApiError } from '../../api/graphql-client.ts';
import type { StudioApi } from '../../api/studio-api.ts';
import type { MediaAsset } from '../../api/types.ts';

const MB = 1024 * 1024;

/** Upload limits of spec 05: image 10 MB, audio 20 MB, video 200 MB and PDF 20 MB. */
const LIMITS: readonly { prefix: string; bytes: number; label: string }[] = [
  { prefix: 'image/', bytes: 10 * MB, label: 'imágenes' },
  { prefix: 'audio/', bytes: 20 * MB, label: 'audio' },
  { prefix: 'video/', bytes: 200 * MB, label: 'video' },
  { prefix: 'application/pdf', bytes: 20 * MB, label: 'PDF' },
];

export class UploadError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'UploadError';
  }
}

/** Checks the type and size of a file against the limits. */
export function checkUpload(mimeType: string, size: number): void {
  const limit = LIMITS.find((candidate) => mimeType.startsWith(candidate.prefix));
  if (limit === undefined) throw new UploadError('Ese tipo de archivo no se puede subir. Usa imágenes, audio, video o PDF.');
  if (size > limit.bytes) throw new UploadError(`El archivo pesa más de ${String(limit.bytes / MB)} MB, el límite para ${limit.label}.`);
}

/** Asks for a signed URL, uploads the file to storage and registers it in the library of the category. */
export async function uploadMedia(api: Pick<StudioApi, 'createMediaUpload' | 'registerMedia'>, categoryId: string, file: File): Promise<MediaAsset> {
  const mimeType = file.type === '' ? 'application/octet-stream' : file.type;
  checkUpload(mimeType, file.size);
  const target = await api.createMediaUpload(categoryId, file.name, mimeType, file.size);
  const response = await fetch(target.uploadUrl, { method: 'PUT', headers: { 'content-type': mimeType }, body: file });
  if (!response.ok) throw new ApiError('InternalError', 'No se pudo subir el archivo.');
  return api.registerMedia(categoryId, target.key, file.name, mimeType, file.size);
}
