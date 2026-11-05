import { AppError } from '../shared/errors/index.ts';

/** Opaque `nextToken` of a list read by offset. */
export function encodeOffset(offset: number): string {
  return Buffer.from(String(offset)).toString('base64url');
}

/** Offset of a `nextToken`; no token starts at 0. */
export function decodeOffset(token: string | undefined): number {
  if (token === undefined || token === '') {
    return 0;
  }
  const offset = Number(Buffer.from(token, 'base64url').toString());
  if (!Number.isInteger(offset) || offset < 0) {
    throw AppError.validation('page.nextToken: no es válido.');
  }
  return offset;
}
