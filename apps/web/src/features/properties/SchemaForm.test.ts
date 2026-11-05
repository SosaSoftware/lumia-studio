import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { componentCatalog } from '@lumia/packages/catalog';
import { rec } from '../../api/decode.ts';
import { AppContext, setApp } from '../../composables/app-context.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import MediaPicker from './MediaPicker.vue';
import SchemaForm from './SchemaForm.vue';

setApp(new AppContext({ apiUrl: '/graphql', authMode: 'dev', lumiUrl: null }));

function formFor(key: string, errors: Record<string, string> = {}, canUpload = false): ReturnType<typeof mount> {
  return mount(SchemaForm, {
    props: {
      schema: { ...componentCatalog.jsonSchema(key) },
      modelValue: { ...rec(componentCatalog.get(key)?.defaults) },
      component: key,
      errors,
      canUpload,
    },
  });
}

describe('SchemaForm', () => {
  it('generates the fields of a title: a short text and choices with Spanish labels', () => {
    const form = formFor('title');
    expect(form.find('input[data-testid="field-text"]').exists()).toBe(true);
    expect(form.find('[data-testid="field-level"]').findAll('[role="radio"]').map((chip) => chip.text())).toEqual(['Principal', 'Secundario']);
    expect(form.find('[data-testid="field-align-left"]').attributes('aria-checked')).toBe('true');
  });

  it('uses a text area for long texts and counts the characters', () => {
    const form = formFor('paragraph');
    expect(form.find('textarea[data-testid="field-text"]').exists()).toBe(true);
    expect(form.text()).toContain('/1200');
  });

  it('generates a list editor for the options and a select for the correct one', () => {
    const form = formFor('multiple_choice');
    expect(form.find('[data-testid="field-options.0.text"]').exists()).toBe(true);
    expect(form.find('[data-testid="field-options.1.id"]').exists()).toBe(true);
    expect(form.find('[data-testid="field-options-add"]').exists()).toBe(true);
    expect(form.find('select[data-testid="field-correctOptionId"]').findAll('option').map((option) => option.text())).toEqual(['A · Opción A', 'B · Opción B']);
    expect(form.find('input[data-testid="field-attempts"]').attributes('max')).toBe('3');
  });

  it('generates a list of texts, yes or no choices, colors, icons and the media selector', () => {
    const list = formFor('bullet_list');
    expect(list.find('[data-testid="field-items-0"]').exists()).toBe(true);
    expect(list.find('[data-testid="field-ordered-true"]').text()).toBe('Numerada');
    expect(formFor('shape').find('[data-testid="field-fill-accent"]').exists()).toBe(true);
    expect(formFor('icon').find('[data-testid="field-name-computer"]').attributes('aria-label')).toBe('Computadora');
    const video = formFor('video', {}, true);
    expect(video.find('[data-testid="media-picker-mediaId"]').exists()).toBe(true);
    expect(video.find('input[type="file"]').exists()).toBe(true);
    expect(formFor('video').find('input[type="file"]').exists()).toBe(false);
    expect(formFor('video').find('[data-testid="media-upload-denied"]').exists()).toBe(true);
  });

  it('edits a table as a grid of cells', async () => {
    const form = formFor('table');
    expect(form.find('[data-testid="table-editor"]').exists()).toBe(true);
    await form.find('[data-testid="field-rows-0-1"]').setValue('Nuevo');
    const emitted = rec(form.emitted('update:modelValue')?.[0]?.[0]);
    expect(emitted.rows).toEqual([['Dato 1', 'Nuevo', 'Dato 3'], ['Dato 4', 'Dato 5', 'Dato 6']]);
  });

  it('shows the API error next to its field, including nested ones', () => {
    const form = formFor('multiple_choice', { question: 'Pregunta demasiado larga.', 'options.1.text': 'Texto requerido.' });
    expect(form.find('[data-testid="field-error-question"]').text()).toBe('Pregunta demasiado larga.');
    expect(form.find('[data-testid="field-question"]').attributes('aria-invalid')).toBe('true');
    expect(form.find('[data-testid="field-error-options.1.text"]').text()).toBe('Texto requerido.');
    expect(form.find('[data-testid="field-error-attempts"]').exists()).toBe(false);
  });

  it('emits the whole props object with the edited value', async () => {
    const form = formFor('title');
    await form.find('input[data-testid="field-text"]').setValue('Nuevo título');
    expect(form.emitted('update:modelValue')?.[0]?.[0]).toEqual({ text: 'Nuevo título', level: 'h2', align: 'left' });
    await form.find('[data-testid="field-align-center"]').trigger('click');
    expect(form.emitted('update:modelValue')?.[1]?.[0]).toMatchObject({ align: 'center' });
  });

  it('adds and removes list items', async () => {
    const form = formFor('multiple_choice');
    await form.find('[data-testid="field-options-add"]').trigger('click');
    expect(form.emitted('update:modelValue')?.[0]?.[0]).toMatchObject({ options: [{ id: 'a' }, { id: 'b' }, { id: 'c', text: 'Opción 3' }] });
    // The list is at its minimum of two options, so removing is blocked.
    expect(form.find('[data-testid="field-options-remove-0"]').attributes('disabled')).toBeDefined();
  });

  it('keeps the image of each gallery item in that item', async () => {
    const asset = { id: '3f2b8f0e-6a1d-4c57-9e1a-2d6a4b0c9f11', name: 'robot.png', mimeType: 'image/png', url: 'https://storage.test/robot.png' };
    useWorkspace().media.add(asset);
    const form = formFor('gallery');
    const pickers = form.findAllComponents(MediaPicker);
    expect(pickers.map((picker) => picker.attributes('data-testid'))).toEqual(['media-picker-items.0.mediaId', 'media-picker-items.1.mediaId']);
    pickers[1]?.vm.$emit('pick', asset);
    await form.vm.$nextTick();
    const props = rec(form.emitted('update:modelValue')?.[0]?.[0]);
    expect(props).toEqual({ items: [{ mediaId: null, alt: 'Imagen 1', caption: '' }, { mediaId: asset.id, alt: 'Imagen 2', caption: '' }] });
    // The element-level medium is only for components with one medium.
    expect(form.emitted('media')).toBeUndefined();
    await form.setProps({ modelValue: props });
    expect(form.find('[data-testid="media-picker-items.1.mediaId"] [data-testid="media-current"]').text()).toBe('robot.png');
  });
});
