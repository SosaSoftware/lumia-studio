import { S3Client } from '@aws-sdk/client-s3';
import { S3PublishedStore } from '../infrastructure/storage/index.ts';
import { StudioRuntime } from '../runtime/studio-runtime.ts';
import { ExportService } from '../services/export-service.ts';
import { Config, ProcessEnvSource } from '../shared/config/index.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function versionIdOf(event: unknown): string {
  const versionId = typeof event === 'object' && event !== null && 'versionId' in event ? event.versionId : undefined;
  if (typeof versionId !== 'string' || !UUID.test(versionId)) throw new Error('The export event needs the versionId of a published version.');
  return versionId;
}

/** Invoked asynchronously by publishing with `{ versionId }`; writes the .lumia to `LUMIA_PUBLISHED_BUCKET`. */
export async function handler(event: unknown): Promise<void> {
  const versionId = versionIdOf(event);
  const runtime = StudioRuntime.current();
  const bucket = new Config(new ProcessEnvSource()).required('LUMIA_PUBLISHED_BUCKET');
  const service = new ExportService(runtime.db, runtime.storage, new S3PublishedStore(new S3Client({}), bucket));
  try {
    const result = await service.export(versionId);
    runtime.logger.info(result === null ? 'Export skipped: the version is not the published one' : 'Class exported', { versionId, key: result?.key ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    runtime.logger.error('Export failed', { versionId, error: message });
    await service.fail(versionId, message);
    // Lambda retries a failed asynchronous invocation; a later success marks the export ready.
    throw error;
  }
}
