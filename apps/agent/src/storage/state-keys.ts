import { createHash } from 'node:crypto';

/** Hex characters kept from each SHA-256 digest: 128 bits, far beyond any collision risk at Lumi's scale. */
const KEY_LENGTH = 32;

function digest(domain: string, value: string): string {
  return createHash('sha256').update(`${domain}\u0000${value}`).digest('hex').slice(0, KEY_LENGTH);
}

/**
 * Key of a person in every store of Lumi, derived from the `sub` of their token.
 *
 * A hash keeps the identifier out of storage paths and AgentCore Memory, and its characters are valid
 * everywhere: S3 keys, file names and AgentCore actor ids.
 */
export function actorKeyOf(sub: string): string {
  return digest('lumi-actor', sub);
}

/**
 * Session id of a conversation, derived from the AG-UI thread id. Strands accepts only lowercase letters,
 * digits, `-` and `_` in session ids, so the thread id is hashed rather than used as is.
 */
export function sessionIdOf(threadId: string): string {
  return digest('lumi-thread', threadId);
}
