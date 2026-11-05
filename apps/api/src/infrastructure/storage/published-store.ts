import { PutObjectCommand } from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';

/** Where published classes go: a versioned bucket in AWS, memory in tests. */
export interface PublishedStore {
  /** Writes the object and returns its version id, or null when the store does not version objects. */
  put(key: string, body: Uint8Array, contentType: string): Promise<{ versionId: string | null }>;
}

/** Published classes in the versioned S3 bucket; republishing a class keeps the earlier object as a previous version. */
export class S3PublishedStore implements PublishedStore {
  public constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  public async put(key: string, body: Uint8Array, contentType: string): Promise<{ versionId: string | null }> {
    const answer = await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
    return { versionId: answer.VersionId ?? null };
  }
}
