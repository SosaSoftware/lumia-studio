import { describe, expect, it } from 'vitest';
import { componentCatalog } from '@lumia/packages/catalog';
import type { SeedNode } from './seed-data.ts';
import { SEED_CATEGORIES, SEED_PEOPLE, SEED_ROLES, SHOWCASE_AUTHOR } from './seed-data.ts';
import { SHOWCASE_SLIDES } from './showcase.ts';

const LOGICAL_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CLASS_NAME = /^[a-z0-9]+(-[a-z0-9]+)*\.lumia$/;

function checkSiblings(nodes: readonly SeedNode[]): void {
  expect(new Set(nodes.map((node) => node.name)).size).toBe(nodes.length);
  for (const node of nodes) {
    expect(node.name).toMatch(node.kind === 'class' ? CLASS_NAME : LOGICAL_NAME);
    if (node.kind === 'folder') checkSiblings(node.children);
  }
}

describe('sandbox seed data', () => {
  it('uses logical names and unique names among siblings', () => {
    for (const category of SEED_CATEGORIES) {
      expect(category.name).toMatch(LOGICAL_NAME);
      for (const subcategory of category.subcategories) {
        expect(subcategory.name).toMatch(LOGICAL_NAME);
        checkSiblings(subcategory.tree);
      }
    }
  });

  it('grants existing categories and subcategories and existing roles', () => {
    const targets = new Set(SEED_CATEGORIES.flatMap((category) => [category.name, ...category.subcategories.map((subcategory) => `${category.name}/${subcategory.name}`)]));
    const roles = new Set(SEED_ROLES.map((role) => role.key));
    for (const person of SEED_PEOPLE) {
      expect(person.role === null || roles.has(person.role)).toBe(true);
      for (const grant of person.grants) expect(targets.has(grant)).toBe(true);
    }
    expect(SEED_PEOPLE.some((person) => person.email === SHOWCASE_AUTHOR && person.role === 'content_creator')).toBe(true);
  });

  it('shows every component of the catalog with valid props', () => {
    const used = new Set(SHOWCASE_SLIDES.flatMap((slide) => slide.elements.map((element) => element.component)));
    expect([...used].sort()).toEqual(componentCatalog.list().map((component) => component.key).sort());
    for (const element of SHOWCASE_SLIDES.flatMap((slide) => slide.elements)) {
      expect(componentCatalog.validateProps(element.component, element.props).ok).toBe(true);
    }
  });
});
