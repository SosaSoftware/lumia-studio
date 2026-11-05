import * as path from 'node:path';

/** Root of the monorepo, where `package-lock.json` and the workspaces live. */
export const REPO_ROOT: string = path.resolve(__dirname, '..');

/** Absolute path of a file of the monorepo, from its path relative to the root. */
export function repoPath(relative: string): string {
  return path.join(REPO_ROOT, relative);
}
