import type { StudioClaims } from '../auth/index.ts';

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

/** Returns the claims when they have the full Lumia Studio shape, or null otherwise. */
export function parseStudioClaims(raw: Readonly<Record<string, unknown>>): StudioClaims | null {
  const { sub, email, name, studio_user_id, studio_role, studio_role_name, studio_actions, studio_categories, studio_subcategories } = raw;
  if (
    !isNonEmpty(sub) || !isNonEmpty(email) || typeof name !== 'string' || !isNonEmpty(studio_user_id) || !isNonEmpty(studio_role) ||
    typeof studio_role_name !== 'string' ||
    !isStringList(studio_actions) || !isStringList(studio_categories) || !isStringList(studio_subcategories)
  ) {
    return null;
  }
  return { sub, email, name, studio_user_id, studio_role, studio_role_name, studio_actions, studio_categories, studio_subcategories };
}
