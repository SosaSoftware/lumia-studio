import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppError } from '../../shared/errors/index.ts';
import type { ObjectStorage } from './object-storage.ts';

type Presign = (client: S3Client, command: GetObjectCommand | PutObjectCommand, options: { expiresIn: number }) => Promise<string>;

/** S3-backed storage with presigned URLs. */
export class S3ObjectStorage implements ObjectStorage {
  public constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
    private readonly presign: Presign = getSignedUrl,
  ) {}

  public async createUploadUrl(key: string, contentType: string, expiresInS: number): Promise<string> {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType });
    return this.presign(this.client, command, { expiresIn: expiresInS });
  }

  public async createDownloadUrl(key: string, expiresInS: number): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return this.presign(this.client, command, { expiresIn: expiresInS });
  }

  public async put(key: string, body: Uint8Array | string, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  public async get(key: string): Promise<Uint8Array> {
    try {
      const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (response.Body === undefined) {
        throw AppError.notFound('El archivo no existe.');
      }
      return await response.Body.transformToByteArray();
    } catch (error) {
      if (S3ObjectStorage.isMissing(error)) {
        throw AppError.notFound('El archivo no existe.');
      }
      throw error;
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (error) {
      if (S3ObjectStorage.isMissing(error)) {
        return false;
      }
      throw error;
    }
  }

  private static isMissing(error: unknown): boolean {
    return error instanceof Error && (error.name === 'NoSuchKey' || error.name === 'NotFound');
  }
}
