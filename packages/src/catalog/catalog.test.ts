import { describe, expect, it } from 'vitest';
import { ADVANCE_MODES, BASE_COMPONENTS, componentCatalog, geometryErrors, overlaps, SLIDE_TYPE_KEYS, SLIDE_TYPES, slideLayoutEngine } from './index.ts';

describe('media of the components', () => {
  it('tells a single media field from media per item', () => {
    expect(componentCatalog.hasMediaField('image')).toBe(true);
    expect(componentCatalog.hasMediaField('gallery')).toBe(false);
    expect(componentCatalog.hasMediaField('title')).toBe(false);
  });

  it('lists every media id that the props reference', () => {
    const id = '3f2b8f0e-6a1d-4c57-9e1a-2d6a4b0c9f11';
    expect(componentCatalog.mediaIds('image', { mediaId: id })).toEqual([id]);
    expect(componentCatalog.mediaIds('gallery', { items: [{ mediaId: id }, { mediaId: null }, { mediaId: id }] })).toEqual([id]);
    expect(componentCatalog.mediaIds('title', { mediaId: id })).toEqual([]);
  });
});

describe('slide types', () => {
  it('advance with a click by default, except quizzes, which wait for their questions', () => {
    for (const type of SLIDE_TYPES) {
      expect(ADVANCE_MODES).toContain(type.defaultAdvance);
      expect(type.defaultAdvance).toBe(type.key === 'quiz' ? 'on_complete' : 'click');
    }
  });
});

describe('component catalog', () => {
  it('has valid defaults and a JSON Schema for every base component', () => {
    expect(BASE_COMPONENTS).toHaveLength(28);
    for (const definition of BASE_COMPONENTS) {
      expect(componentCatalog.validateProps(definition.key, definition.defaults)).toMatchObject({ ok: true });
      const schema = componentCatalog.jsonSchema(definition.key);
      expect(schema).toHaveProperty('properties');
    }
  });

  it('rejects unknown components, invalid props and unknown keys with the field path', () => {
    expect(componentCatalog.validateProps('carousel', {})).toMatchObject({ ok: false, errors: [{ path: 'component' }] });

    const invalid = componentCatalog.validateProps('title', { text: '', level: 'h1', align: 'left' });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.errors[0]?.path).toBe('props.text');

    const extra = componentCatalog.validateProps('title', { text: 'Hola', level: 'h1', align: 'left', color: 'red' });
    expect(extra.ok).toBe(false);
  });

  it('checks that the correct option of a multiple choice question exists and ids are unique', () => {
    const base = componentCatalog.get('multiple_choice')?.defaults as Record<string, unknown>;
    const wrongAnswer = componentCatalog.validateProps('multiple_choice', { ...base, correctOptionId: 'z' });
    expect(wrongAnswer.ok).toBe(false);
    if (!wrongAnswer.ok) expect(wrongAnswer.errors.map((error) => error.path)).toContain('props.correctOptionId');

    const duplicated = componentCatalog.validateProps('multiple_choice', {
      ...base,
      options: [
        { id: 'a', text: 'Uno' },
        { id: 'a', text: 'Dos' },
      ],
    });
    expect(duplicated.ok).toBe(false);
  });

  it('validates diagram: unique node IDs and edges reference existing nodes', () => {
    const base = componentCatalog.get('diagram')?.defaults as Record<string, unknown>;
    expect(componentCatalog.validateProps('diagram', base)).toMatchObject({ ok: true });

    const duplicateNodes = componentCatalog.validateProps('diagram', {
      ...base,
      nodes: [
        { id: 'a', text: 'Uno' },
        { id: 'a', text: 'Dos' },
      ],
    });
    expect(duplicateNodes.ok).toBe(false);
    if (!duplicateNodes.ok) expect(duplicateNodes.errors.map((e) => e.path)).toContain('props.nodes');

    const badEdge = componentCatalog.validateProps('diagram', {
      ...base,
      edges: [{ from: 'a', to: 'z' }],
    });
    expect(badEdge.ok).toBe(false);
    if (!badEdge.ok) expect(badEdge.errors.map((e) => e.path)).toContain('props.edges');
  });

  it('validates fill_blank: at least one [[blank]]', () => {
    const base = componentCatalog.get('fill_blank')?.defaults as Record<string, unknown>;
    expect(componentCatalog.validateProps('fill_blank', base)).toMatchObject({ ok: true });

    const noBlank = componentCatalog.validateProps('fill_blank', {
      ...base,
      text: 'No tiene espacios en blanco.',
    });
    expect(noBlank.ok).toBe(false);
    if (!noBlank.ok) expect(noBlank.errors.map((e) => e.path)).toContain('props.text');
  });

  it('validates drag_drop: unique IDs and correctItemId references an item', () => {
    const base = componentCatalog.get('drag_drop')?.defaults as Record<string, unknown>;
    expect(componentCatalog.validateProps('drag_drop', base)).toMatchObject({ ok: true });

    const dupItems = componentCatalog.validateProps('drag_drop', {
      ...base,
      items: [
        { id: 'x', text: 'Uno' },
        { id: 'x', text: 'Dos' },
      ],
    });
    expect(dupItems.ok).toBe(false);
    if (!dupItems.ok) expect(dupItems.errors.map((e) => e.path)).toContain('props.items');

    const dupTargets = componentCatalog.validateProps('drag_drop', {
      ...base,
      targets: [
        { id: 't', text: 'D1', correctItemId: 'i1' },
        { id: 't', text: 'D2', correctItemId: 'i2' },
      ],
    });
    expect(dupTargets.ok).toBe(false);
    if (!dupTargets.ok) expect(dupTargets.errors.map((e) => e.path)).toContain('props.targets');

    const badRef = componentCatalog.validateProps('drag_drop', {
      ...base,
      targets: [
        { id: 't1', text: 'D1', correctItemId: 'i1' },
        { id: 't2', text: 'D2', correctItemId: 'MISSING' },
      ],
    });
    expect(badRef.ok).toBe(false);
    if (!badRef.ok) expect(badRef.errors.map((e) => e.path)).toContain('props.targets');
  });

  it('fills defaults and validates geometry of an element', () => {
    expect(componentCatalog.withDefaults('paragraph', { text: 'Hoy aprendemos fracciones' })).toMatchObject({
      ok: true,
      props: { text: 'Hoy aprendemos fracciones', size: 'md' },
    });
    const outside = componentCatalog.validateElement({
      component: 'paragraph',
      props: componentCatalog.get('paragraph')?.defaults,
      geometry: { x: 90, y: 50, w: 20, h: 10 },
    });
    expect(outside.ok).toBe(false);
    if (!outside.ok) expect(outside.errors.every((error) => error.path === 'geometry')).toBe(true);
  });

  it('describes every component compactly for Lumi', () => {
    const compact = componentCatalog.compact();
    expect(compact).toHaveLength(28);
    for (const entry of compact) expect(entry.props.length).toBeGreaterThan(0);
    expect(compact.find((entry) => entry.key === 'multiple_choice')?.props).toContain('options');
  });
});

describe('slide layout engine', () => {
  const keys = BASE_COMPONENTS.map((definition) => definition.key);
  const combinations: string[][] = [];
  for (let size = 1; size <= 4; size += 1) {
    for (let start = 0; start < keys.length; start += 1) {
      combinations.push(Array.from({ length: size }, (_, offset) => keys[(start + offset * 3) % keys.length] ?? 'paragraph'));
    }
  }

  it.each(SLIDE_TYPE_KEYS)('places 1 to 4 elements inside a %s slide without overlaps', (slideType) => {
    for (const components of [...combinations, ['title', 'paragraph', 'image'], ['title', 'video', 'paragraph']]) {
      const placed = slideLayoutEngine.place(slideType, components.map((component) => ({ component })));
      expect(placed).toHaveLength(components.length);
      placed.forEach((geometry, index) => {
        expect(geometryErrors(geometry), `${slideType} ${components.join(',')} #${String(index)}`).toEqual([]);
        placed.slice(index + 1).forEach((other) => {
          expect(overlaps(geometry, other), `${slideType} ${components.join(',')}`).toBe(false);
        });
      });
    }
  });
});
