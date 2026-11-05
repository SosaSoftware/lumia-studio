/** Object storage contract. Locally the file system; in AWS, S3. */
export interface ObjectStorage {
  createUploadUrl(key: string, contentType: string, expiresInS: number): Promise<string>;
  createDownloadUrl(key: string, expiresInS: number): Promise<string>;
  put(key: string, body: Uint8Array | string, contentType: string): Promise<void>;
  /** Throws `AppError('NotFound')` when the object does not exist. */
  get(key: string): Promise<Uint8Array>;
  exists(key: string): Promise<boolean>;
}
