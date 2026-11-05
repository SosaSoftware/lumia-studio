/** True when a database error is a unique-index violation (`pg` code 23505, or the Data API message). */
export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  if ('code' in error && error.code === '23505') {
    return true;
  }
  return error instanceof Error && error.message.includes('duplicate key value violates unique constraint');
}
