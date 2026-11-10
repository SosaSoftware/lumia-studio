import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { setApp } from '../composables/app-context.ts';
import { AppContext } from '../composables/app-context.ts';
import DemoPage from './DemoPage.vue';

const DEFINITION = {
  format: 'lumia',
  formatVersion: 1,
  class: { displayName: 'Demo Video' },
  slides: [{ id: 's1', position: 1, title: 'Portada', background: 'surface', durationS: 6, transition: 'none', advance: 'auto', elements: [], narrationClips: [], pauses: [], audioClips: [] }],
  media: {},
};

function demoResponses(): typeof fetch {
  return ((url: string): Promise<Response> => {
    if (url.endsWith('/demo.json')) return Promise.resolve(new Response(JSON.stringify({ file: '/demo-content/demo.lumia' }), { status: 200 }));
    if (url.endsWith('/demo-content/demo.lumia')) return Promise.resolve(new Response(zipSync({ 'definition.json': strToU8(JSON.stringify(DEFINITION)) }), { status: 200 }));
    throw new Error(`unexpected fetch ${url}`);
  }) as unknown as typeof fetch;
}

describe('DemoPage', () => {
  beforeEach(() => {
    setApp(new AppContext({ apiUrl: '/graphql', authMode: 'dev', lumiUrl: null }));
    vi.stubGlobal('fetch', demoResponses());
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:demo', revokeObjectURL: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the logo, waits for start(), and does not sign the person in', async () => {
    const seen: Record<string, unknown>[] = [];
    const Player = { template: '<div data-testid="preview" />', props: ['slides', 'media', 'className', 'isQuestion', 'chrome', 'autoStart'], methods: { play() { /* stub */ } }, created(this: { $props: Record<string, unknown> }) { seen.push(this.$props); } };
    const page = mount(DemoPage, { global: { stubs: { PreviewPlayer: Player } } });
    expect(page.find('[data-testid="demo-logo"]').exists()).toBe(true);
    await flushPromises();
    expect(page.find('[data-testid="preview"]').exists()).toBe(true);
    expect(seen[0]).toMatchObject({ autoStart: false, chrome: false });
    expect(page.find('[data-testid="sign-in-open"]').exists()).toBe(false);
  });

  it('start() begins the player', async () => {
    const play = vi.fn();
    const page = mount(DemoPage, { global: { stubs: { PreviewPlayer: { template: '<div data-testid="preview" />', methods: { play } } } } });
    await flushPromises();
    (page.vm as unknown as { start: () => void }).start();
    expect(play).toHaveBeenCalledTimes(1);
  });
});
