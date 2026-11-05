import { S3Client } from '@aws-sdk/client-s3';
import type { Config } from '../../shared/config/index.ts';
import { ConfigError } from '../../shared/config/index.ts';
import { FileSystemObjectStorage } from './file-system-object-storage.ts';
import type { ObjectStorage } from './object-storage.ts';
import { S3ObjectStorage } from './s3-object-storage.ts';

/** Builds the storage selected by `LUMIA_STORAGE_DRIVER` (`filesystem` or `s3`). */
export function createObjectStorage(config: Config): ObjectStorage {
  const driver = config.optional('LUMIA_STORAGE_DRIVER', 'filesystem');
  if (driver === 's3') {
    // Browsers upload with presigned PUT URLs and send no checksum headers; the SDK adds checksums only when S3 requires them.
    const client = new S3Client({ requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' });
    return new S3ObjectStorage(client, config.required('LUMIA_MEDIA_BUCKET'));
  }
  if (driver === 'filesystem') {
    const port = config.integer('LUMIA_API_PORT', 4000);
    return new FileSystemObjectStorage({
      root: config.optional('LUMIA_STORAGE_ROOT', '.sandbox/storage'),
      baseUrl: config.optional('LUMIA_API_BASE_URL', `http://localhost:${String(port)}`),
      signingSecret: config.required('LUMIA_STORAGE_SIGNING_SECRET'),
    });
  }
  throw new ConfigError('LUMIA_STORAGE_DRIVER', `"${driver}" is not supported; use "filesystem" or "s3"`);
}
