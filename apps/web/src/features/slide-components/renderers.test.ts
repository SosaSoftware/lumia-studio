import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { componentCatalog } from '@lumia/packages/catalog';
import { rec } from '../../api/decode.ts';
import type { SlideElement } from '../../api/types.ts';
import { CATALOG_COMPONENTS } from './index.ts';
import type { ElementMode } from './element-mode.ts';
import { provideSlideContext } from './slide-context.ts';
import type { SlideContext } from './slide-context.ts';

const MODES: readonly ElementMode[] = ['edit', 'student'];

function render(key: string, mode: ElementMode, data: Record<string, unknown> = {}, extra: { selected?: boolean; context?: SlideContext; elementId?: string } = {}): ReturnType<typeof mount> {
  const component = CATALOG_COMPONENTS[key];
  if (component === undefined) throw new Error(`Sin render para ${key}`);
  const props = { data: { ...rec(componentCatalog.get(key)?.defaults), ...data }, mode, media: null, elementId: extra.elementId ?? 'e1', selected: extra.selected ?? false };
  const context = extra.context;
  const host = defineComponent({
    setup: () => {
      if (context !== undefined) provideSlideContext(context);
      return () => h(component, props);
    },
  });
  return mount(host);
}

function sibling(id: string, component: string, x: number, y: number): SlideElement {
  return { id, slideId: 's', component, name: component, x, y, w: 10, h: 10, z: 1, appearsAtS: 0, entrance: 'none', props: {}, mediaId: null, media: null };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('catalog renderers', () => {
  it('render the 28 components in both modes with their default props', () => {
    const keys = componentCatalog.list().map((definition) => definition.key);
    expect(keys).toHaveLength(28);
    for (const key of keys) {
      for (const mode of MODES) {
        const wrapper = render(key, mode);
        expect(wrapper.html(), `${key} en modo ${mode}`).not.toBe('');
        wrapper.unmount();
      }
    }
  });

  it('show the texts of text components, the placeholder of missing media and the table header', () => {
    expect(render('title', 'edit').text()).toBe('Título');
    expect(render('bullet_list', 'edit', { items: ['Pantalla: lo que ves'], ordered: true }).find('b').text()).toBe('Pantalla:');
    expect(render('callout', 'edit').text()).toContain('Idea clave');
    expect(render('image', 'edit', { alt: 'Una computadora' }).find('[role="img"]').attributes('aria-label')).toBe('Una computadora');
    expect(render('table', 'edit').findAll('th').map((cell) => cell.text())).toEqual(['Columna 1', 'Columna 2', 'Columna 3']);
    expect(render('audio', 'edit').text()).toContain('Sin audio');
  });

  it('draw a free connector, a linked one, and warn about a missing element in the editor', () => {
    expect(render('connector', 'edit').find('svg.free').exists()).toBe(true);
    const context: SlideContext = { elements: () => [sibling('e1', 'connector', 20, 10), sibling('a', 'shape', 0, 0), sibling('b', 'shape', 50, 30)], media: () => null, navigator: null };
    const linked = render('connector', 'student', { fromElementId: 'a', toElementId: 'b' }, { context });
    expect(linked.find('svg.linked path').attributes('d')).toBe('M5 5 L55 35');
    expect(render('connector', 'edit', { fromElementId: 'x', toElementId: 'b' }, { context }).text()).toContain('Elige dos elementos');
    expect(render('connector', 'student', { fromElementId: 'x', toElementId: 'b' }, { context }).find('svg').exists()).toBe(false);
  });

  it('lay out a hierarchy diagram from its root', () => {
    const diagram = render('diagram', 'edit', { kind: 'hierarchy', nodes: [{ id: 'a', text: 'Raíz' }, { id: 'b', text: 'Hijo' }, { id: 'c', text: 'Nieto' }], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }] });
    expect(diagram.find('.root').text()).toBe('Raíz');
    expect(diagram.find('.card-title').text()).toBe('Hijo');
    expect(diagram.find('.leaf').text()).toBe('Nieto');
  });

  it('flip the card, switch tabs, open sections and browse the gallery in the preview', async () => {
    const card = render('flip_card', 'student');
    await card.find('[data-testid="flip-card"]').trigger('click');
    expect(card.find('[data-testid="flip-card"]').attributes('aria-pressed')).toBe('true');
    const tabs = render('tabs', 'student');
    await tabs.findAll('[role="tab"]')[1]?.trigger('click');
    expect(tabs.findAll('[role="tab"]')[1]?.attributes('aria-selected')).toBe('true');
    expect(tabs.text()).toContain('Contenido de la segunda pestaña.');
    const accordion = render('accordion', 'student');
    await accordion.findAll('button')[1]?.trigger('click');
    expect(accordion.findAll('button')[1]?.attributes('aria-expanded')).toBe('true');
    const gallery = render('gallery', 'student');
    await gallery.find('[aria-label="Imagen siguiente"]').trigger('click');
    expect(gallery.find('[role="group"]').attributes('aria-label')).toBe('Galería, imagen 2 de 2');
  });

  it('count down the timer and navigate with the button', async () => {
    vi.useFakeTimers();
    const timer = render('timer', 'student', { seconds: 60 });
    await timer.find('[data-testid="timer-start"]').trigger('click');
    await vi.advanceTimersByTimeAsync(2000);
    expect(timer.find('.face').text()).toBe('0:58');
    const next = vi.fn();
    const context: SlideContext = { elements: () => [], media: () => null, navigator: { next, goTo: vi.fn() } };
    await render('button_link', 'student', {}, { context }).find('button').trigger('click');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('show the hotspot bubble when selected in the editor and on click in the preview', async () => {
    expect(render('hotspot', 'edit', {}, { selected: true }).find('[role="tooltip"]').exists()).toBe(true);
    expect(render('hotspot', 'edit').find('[role="tooltip"]').exists()).toBe(false);
    const live = render('hotspot', 'student');
    await live.find('button').trigger('click');
    expect(live.find('button').attributes('aria-expanded')).toBe('true');
  });

  it('give feedback and count attempts in a multiple choice question', async () => {
    const question = render('multiple_choice', 'student', { attempts: 2 });
    await question.find('[data-testid="question-option-b"]').trigger('click');
    await question.find('[data-testid="question-check"]').trigger('click');
    expect(question.find('[data-testid="question-feedback"]').attributes('data-result')).toBe('incorrect');
    expect(question.find('[data-testid="question-attempts"]').text()).toContain('1');
    await question.find('[data-testid="question-option-a"]').trigger('click');
    await question.find('[data-testid="question-check"]').trigger('click');
    expect(question.find('[data-testid="question-feedback"]').attributes('data-result')).toBe('correct');
    expect(render('multiple_choice', 'edit').text()).toContain('Correcta');
  });

  it('answer true or false directly', async () => {
    const wrong = render('true_false', 'student');
    await wrong.find('[data-testid="question-tf-false"]').trigger('click');
    expect(wrong.find('[data-testid="question-feedback"]').attributes('data-result')).toBe('incorrect');
    const right = render('true_false', 'student');
    await right.find('[data-testid="question-tf-true"]').trigger('click');
    expect(right.find('[data-testid="question-feedback"]').attributes('data-result')).toBe('correct');
  });

  it('check a fill in the blank answer without case', async () => {
    const question = render('fill_blank', 'student', { text: 'La capital es [[Guatemala]].' });
    await question.find('[data-testid="question-blank-0"]').setValue('guatemala');
    await question.find('[data-testid="question-check"]').trigger('click');
    expect(question.find('[data-testid="question-feedback"]').attributes('data-result')).toBe('correct');
  });

  it('place items in their targets', async () => {
    const question = render('drag_drop', 'student');
    const pairs: readonly (readonly [string, string])[] = [['Elemento 1', 'Destino 1'], ['Elemento 2', 'Destino 2']];
    for (const [item, target] of pairs) {
      await question.findAll('button.chip').find((chip) => chip.text().includes(item))?.trigger('click');
      await question.findAll('.zone').find((zone) => zone.text().includes(target))?.trigger('click');
    }
    await question.find('[data-testid="question-check"]').trigger('click');
    expect(question.find('[data-testid="question-feedback"]').attributes('data-result')).toBe('correct');
  });

  it('start an ordering question shuffled and accept the right order', async () => {
    const question = render('ordering', 'student', { items: ['Uno', 'Dos'] });
    expect(question.findAll('.text').map((item) => item.text())).toEqual(['Dos', 'Uno']);
    await question.find('[aria-label="Subir Uno"]').trigger('click');
    await question.find('[data-testid="question-check"]').trigger('click');
    expect(question.find('[data-testid="question-feedback"]').attributes('data-result')).toBe('correct');
  });

  it('join the pairs of a matching question', async () => {
    const question = render('matching', 'student');
    const left = question.findAll('.left button');
    const answers: readonly (readonly [number, string])[] = [[0, 'Definición A'], [1, 'Definición B']];
    for (const [index, right] of answers) {
      await left[index]?.trigger('click');
      await question.findAll('.right button').find((button) => button.text().includes(right))?.trigger('click');
    }
    await question.find('[data-testid="question-check"]').trigger('click');
    expect(question.find('[data-testid="question-feedback"]').attributes('data-result')).toBe('correct');
  });

describe('question completion', () => {
  function tracking(): { context: SlideContext; reports: [string, boolean][] } {
    const reports: [string, boolean][] = [];
    const context: SlideContext = { elements: () => [], media: () => null, navigator: null, questions: { report: (id, done) => reports.push([id, done]) } };
    return { context, reports };
  }

  it('reports a question as completed after a correct answer', async () => {
    const { context, reports } = tracking();
    const wrapper = render('true_false', 'student', { answer: false, attempts: 2 }, { context, elementId: 'q-1' });
    expect(reports).toEqual([['q-1', false]]);
    await wrapper.get('[data-testid="question-tf-false"]').trigger('click');
    expect(reports.at(-1)).toEqual(['q-1', true]);
  });

  it('reports a question as completed when the attempts run out, and as pending when it leaves the slide', async () => {
    const { context, reports } = tracking();
    const wrapper = render('true_false', 'student', { answer: false, attempts: 1 }, { context, elementId: 'q-2' });
    await wrapper.get('[data-testid="question-tf-true"]').trigger('click');
    expect(reports.at(-1)).toEqual(['q-2', true]);
    wrapper.unmount();
    expect(reports.at(-1)).toEqual(['q-2', false]);
  });
});
});
