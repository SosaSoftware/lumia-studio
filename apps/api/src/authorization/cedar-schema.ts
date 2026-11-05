import type { Schema } from '@cedar-policy/cedar-wasm/nodejs';
import { PERMISSION_CATALOG } from '../auth/index.ts';

/** Versioned Cedar schema of Lumia Studio; `npm run cedar:schema -w @lumia/api` regenerates it from the catalog. */
export const CEDAR_SCHEMA_URL = new URL('../../cedar/schema.cedarschema.json', import.meta.url);

/** Builds the Cedar schema (JSON format, namespace `Studio`) from the permission catalog. */
export function buildCedarSchema(): Record<string, unknown> {
  const actions: Record<string, unknown> = {};
  for (const permission of PERMISSION_CATALOG) {
    actions[permission.key] = {
      appliesTo: { principalTypes: ['User'], resourceTypes: ['Resource'] },
    };
  }
  const stringSet = { type: 'Set', element: { type: 'String' } };
  const optionalString = { type: 'String', required: false };
  return {
    Studio: {
      entityTypes: {
        Role: { shape: { type: 'Record', attributes: {} } },
        User: {
          memberOfTypes: ['Role'],
          shape: { type: 'Record', attributes: { categories: stringSet, subcategories: stringSet } },
        },
        Resource: {
          shape: { type: 'Record', attributes: { category: optionalString, subcategory: optionalString } },
        },
      },
      actions,
    },
  };
}

/**
 * The Cedar schema used to authorize. It is built from the permission catalog, so a Lambda bundle needs no extra
 * file; a unit test keeps the versioned file equal to it.
 */
export function loadCedarSchema(): Schema {
  // `buildCedarSchema` returns the JSON Cedar schema format that cedar-wasm takes as `Schema`.
  return buildCedarSchema() as Schema;
}
