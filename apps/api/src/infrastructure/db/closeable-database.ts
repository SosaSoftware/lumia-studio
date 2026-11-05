import type { Database } from './database.ts';

/** A database whose underlying connections must be released explicitly (scripts and tests). */
export interface CloseableDatabase extends Database {
  close(): Promise<void>;
}
