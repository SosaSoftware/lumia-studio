import { readFileSync } from 'node:fs';
import { validate } from '@cedar-policy/cedar-wasm/nodejs';
import { describe, expect, it } from 'vitest';
import { CEDAR_SCHEMA, ROLE_ACTIONS, policiesByRole } from '../../test/support/claims.ts';
import { PERMISSION_CATALOG } from '../auth/index.ts';
import { CEDAR_SCHEMA_URL, buildCedarSchema } from './cedar-schema.ts';
import { PolicyGenerator } from './policy-generator.ts';

describe('PERMISSION_CATALOG', () => {
  it('has five unique actions', () => {
    expect(PERMISSION_CATALOG).toHaveLength(5);
    expect(new Set(PERMISSION_CATALOG.map((permission) => permission.key)).size).toBe(5);
  });
});

describe('cedar schema file', () => {
  it('matches the schema generated from the catalog', () => {
    expect(JSON.parse(readFileSync(CEDAR_SCHEMA_URL, 'utf8'))).toEqual(buildCedarSchema());
    expect(CEDAR_SCHEMA).toEqual(buildCedarSchema());
  });
});

describe('PolicyGenerator', () => {
  it('returns null without actions', () => {
    expect(PolicyGenerator.forRole('empty', [])).toBeNull();
  });

  it.each(Object.keys(ROLE_ACTIONS))('validates the %s policy against the schema', (role) => {
    const text = policiesByRole()[role];
    expect(text).toBeDefined();
    const answer = validate({ schema: CEDAR_SCHEMA, policies: { staticPolicies: { [role]: text ?? '' } } });
    expect(answer.type).toBe('success');
    if (answer.type === 'success') {
      expect(answer.validationErrors).toEqual([]);
    }
  });
});
