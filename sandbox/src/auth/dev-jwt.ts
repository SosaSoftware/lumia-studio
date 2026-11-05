import { AppError } from '@lumia/api/errors';

export const DEV_JWT_ISSUER = 'lumia-studio-sandbox';
export const DEV_JWT_TTL_S = 8 * 60 * 60;

/** Encodes the HS256 secret; rejects short secrets that would make the signature trivial to guess. */
export function encodeSecret(secret: string): Uint8Array {
  if (secret.length < 16) {
    throw AppError.internal('LUMIA_DEV_JWT_SECRET must have at least 16 characters.');
  }
  return new TextEncoder().encode(secret);
}
