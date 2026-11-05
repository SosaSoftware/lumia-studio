import { describe, expect, it } from 'vitest';
import { componentCatalog } from '@lumia/packages/catalog';
import { blankItem, describeSchema, errorKey, getAtPath, nextLetterId, setAtPath } from './schema-form-model.ts';

function fieldsOf(key: string): ReturnType<typeof describeSchema> {
  return describeSchema({ ...componentCatalog.jsonSchema(key) });
}

function kinds(key: string): Record<string, string> {
  return Object.fromEntries(fieldsOf(key).map((field) => [field.key, field.kind]));
}

describe('describeSchema', () => {
  it('uses single-line inputs for short limits and text areas for long ones', () => {
    const title = fieldsOf('title').find((field) => field.key === 'text');
    const paragraph = fieldsOf('paragraph').find((field) => field.key === 'text');
    expect(title).toMatchObject({ kind: 'text', maxLength: 120, multiline: false, label: 'Texto' });
    expect(paragraph).toMatchObject({ kind: 'text', maxLength: 1200, multiline: true });
  });

  it('maps enumerations, booleans and numbers', () => {
    expect(kinds('title')).toEqual({ text: 'text', level: 'enum', align: 'enum' });
    expect(kinds('video')).toEqual({ mediaId: 'media', title: 'text', prompt: 'text', startAtS: 'number', autoplay: 'boolean' });
    expect(fieldsOf('shape').find((field) => field.key === 'strokeWidth')).toMatchObject({ kind: 'number', min: 0, max: 8, integer: false });
    expect(fieldsOf('true_false').find((field) => field.key === 'attempts')).toMatchObject({ kind: 'number', min: 1, max: 3, integer: true });
  });

  it('maps lists of texts and lists of objects', () => {
    expect(fieldsOf('bullet_list').find((field) => field.key === 'items')).toMatchObject({ kind: 'string-list', minItems: 1, maxItems: 8, itemMaxLength: 200 });
    const options = fieldsOf('multiple_choice').find((field) => field.key === 'options');
    expect(options).toMatchObject({ kind: 'object-list', minItems: 2, maxItems: 6 });
    expect(options?.kind === 'object-list' ? options.fields.map((field) => field.key) : []).toEqual(['id', 'text']);
  });

  it('detects the media selector in image and video', () => {
    expect(kinds('image').mediaId).toBe('media');
    expect(kinds('video').mediaId).toBe('media');
  });

  it('covers every base component without unsupported kinds', () => {
    for (const definition of componentCatalog.list()) {
      expect(fieldsOf(definition.key).length).toBeGreaterThan(0);
    }
  });
});

describe('path helpers', () => {
  const props = { options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], text: 'x' };

  it('reads nested values', () => {
    expect(getAtPath(props, ['options', 1, 'text'])).toBe('B');
    expect(getAtPath(props, ['missing', 0])).toBeUndefined();
  });

  it('updates nested values without mutating the original', () => {
    const next = setAtPath(props, ['options', 1, 'text'], 'Nueva');
    expect(getAtPath(next, ['options', 1, 'text'])).toBe('Nueva');
    expect(props.options[1]?.text).toBe('B');
    expect(getAtPath(next, ['options', 0, 'text'])).toBe('A');
  });

  it('formats the API error key', () => {
    expect(errorKey(['options', 0, 'text'])).toBe('options.0.text');
  });
});

describe('new list items', () => {
  it('picks the next unused id', () => {
    expect(nextLetterId(['a', 'b'])).toBe('c');
    expect(nextLetterId([])).toBe('a');
  });

  it('builds a valid option for a question', () => {
    const options = fieldsOf('multiple_choice').find((field) => field.key === 'options');
    const fields = options?.kind === 'object-list' ? options.fields : [];
    expect(blankItem(fields, [{ id: 'a', text: 'Opción 1' }, { id: 'b', text: 'Opción 2' }])).toEqual({ id: 'c', text: 'Opción 3' });
  });
});
