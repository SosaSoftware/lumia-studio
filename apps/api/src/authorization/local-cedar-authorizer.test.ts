import { describe, expect, it } from 'vitest';
import { CEDAR_SCHEMA, makeClaims, policiesByRole } from '../../test/support/claims.ts';
import { ACTIONS } from '../auth/index.ts';
import { LocalCedarAuthorizer } from './local-cedar-authorizer.ts';

const CENTRAL = 'cat-central';
const OTHER = 'cat-other';
const AI = 'sub-ai';
const MATH = 'sub-math';

/** Granted the whole Central category: both of its subcategories. */
const creator = makeClaims({ studio_role: 'content_creator', studio_user_id: 'creator', studio_categories: [CENTRAL], studio_subcategories: [AI, MATH] });
/** Granted only the Math subcategory of Central. */
const mathCreator = makeClaims({ studio_role: 'content_creator', studio_user_id: 'math', studio_categories: [CENTRAL], studio_subcategories: [MATH] });
const viewer = makeClaims({ studio_role: 'viewer', studio_user_id: 'viewer', studio_categories: [CENTRAL], studio_subcategories: [AI] });

const inTree = (category: string, subcategory: string): { type: string; id: string; category: string; subcategory: string } => ({
  type: 'slide', id: 'slide-1', category, subcategory,
});

const cases = [
  ['creator edits a class of a granted category', creator, ACTIONS.documentsEdit, inTree(CENTRAL, AI), true],
  ['creator edits a class of another category', creator, ACTIONS.documentsEdit, inTree(OTHER, 'sub-x'), false],
  ['math creator edits math', mathCreator, ACTIONS.documentsEdit, inTree(CENTRAL, MATH), true],
  ['math creator edits AI in the same category', mathCreator, ACTIONS.documentsEdit, inTree(CENTRAL, AI), false],
  ['math creator uploads media to the category', mathCreator, ACTIONS.mediaUpload, { type: 'category', id: CENTRAL, category: CENTRAL }, true],
  ['math creator uploads media to another category', mathCreator, ACTIONS.mediaUpload, { type: 'category', id: OTHER, category: OTHER }, false],
  ['creator reads a record without scope', creator, ACTIONS.documentsView, { type: 'catalog', id: 'x' }, true],
  ['viewer reads a granted class', viewer, ACTIONS.documentsView, inTree(CENTRAL, AI), true],
  ['viewer edits a granted class', viewer, ACTIONS.documentsEdit, inTree(CENTRAL, AI), false],
] as const;

describe('LocalCedarAuthorizer', () => {
  const authorizer = new LocalCedarAuthorizer(policiesByRole(), CEDAR_SCHEMA);

  it.each(cases)('%s', async (_name, claims, action, resource, allowed) => {
    const decision = await authorizer.isAuthorized({ claims, action, resource });
    expect(decision.allowed).toBe(allowed);
    if (allowed) expect(decision.reasons).toEqual([claims.studio_role]);
  });
});
