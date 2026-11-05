import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ConfirmCard from './ConfirmCard.vue';
import type { ChatItem } from './lumi-session.ts';

const pending: ChatItem = {
  id: 'c1',
  type: 'confirm',
  content: '¿Borro la portada?',
  confirmState: 'pending',
  action: 'studio-slides___delete_slide',
  targets: [{ kind: 'slide', id: 'sl1', label: 'Portada' }],
};

describe('ConfirmCard', () => {
  it('takes the focus, answers with its buttons and Esc, and shows the targets', async () => {
    const card = mount(ConfirmCard, { props: { item: pending }, attachTo: document.body });
    await card.vm.$nextTick();
    expect(document.activeElement).toBe(card.element);
    expect(card.find('[data-testid="confirm-yes"]').classes()).toContain('danger');
    await card.find('[data-testid="confirm-yes"]').trigger('click');
    await card.find('[data-testid="confirm-no"]').trigger('click');
    await card.trigger('keydown', { key: 'Escape' });
    expect(card.emitted('answer')).toEqual([[true], [false], [false]]);
    await card.find('[data-testid="confirm-target-sl1"]').trigger('click');
    expect(card.emitted('show')).toEqual([[pending.targets?.[0]]]);
    card.unmount();
  });

  it('keeps the decision in the history and does not answer anymore', async () => {
    for (const [state, label] of [['yes', 'Confirmado'], ['no', 'Cancelado'], ['expired', 'Venció']] as const) {
      const card = mount(ConfirmCard, { props: { item: { ...pending, confirmState: state } } });
      expect(card.find('[data-testid="confirm-result"]').text()).toBe(label);
      expect(card.find('[data-testid="confirm-yes"]').exists()).toBe(false);
      await card.trigger('keydown', { key: 'Escape' });
      expect(card.emitted('answer')).toBeUndefined();
    }
  });
});
