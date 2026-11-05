import { ACTIONS, PERMISSION_CATALOG } from '../../src/auth/index.ts';
import type { StudioClaims } from '../../src/auth/index.ts';
import { loadCedarSchema, PolicyGenerator } from '../../src/authorization/index.ts';

export const CEDAR_SCHEMA = loadCedarSchema();

const ALL_KEYS = PERMISSION_CATALOG.map((permission) => permission.key);

/** Roles of the tests; the sandbox seed and the database hold the real ones. */
export const ROLE_ACTIONS: Readonly<Record<string, readonly string[]>> = {
  admin: ALL_KEYS,
  content_creator: ALL_KEYS,
  viewer: [ACTIONS.documentsView],
};

export function policiesByRole(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [role, actions] of Object.entries(ROLE_ACTIONS)) {
    const text = PolicyGenerator.forRole(role, actions);
    if (text !== null) result[role] = text;
  }
  return result;
}

export function makeClaims(overrides: Partial<StudioClaims> & Pick<StudioClaims, 'studio_role'>): StudioClaims {
  return {
    sub: 'sub-1',
    email: 'user@example.test',
    name: 'Persona de prueba',
    studio_user_id: 'user-1',
    studio_role_name: overrides.studio_role,
    studio_actions: [...(ROLE_ACTIONS[overrides.studio_role] ?? [])],
    studio_categories: [],
    studio_subcategories: [],
    ...overrides,
  };
}
