import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { DemoUnavailableError, demoFileUrl, download } from './demo-source.ts';
import { LumiaFileError, openLumia } from './lumia-file.ts';
import type { ObjectUrls } from './lumia-file.ts';

const IMAGE = '3f2b8f0e-6a1d-4c57-9e1a-2d6a4b0c9f11';

function definition(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    format: 'lumia',
    formatVersion: 1,
    class: { displayName: 'Demo Video' },
    slides: [
      {
        id: 's2',
        position: 2,
        type: 'explanatory',
        title: 'Segunda',
        background: 'surface',
        durationS: 6,
        transition: 'fade',
        advance: 'auto',
        elements: [{ id: 'e2', component: 'image', name: 'Imagen', x: 1, y: 2, w: 30, h: 20, z: 1, appearsAtS: 0, entrance: 'none', props: { mediaId: IMAGE, alt: 'Robot' } }],
        narrationClips: [
          { id: 'n1', startsAtS: 0, script: 'Hola', voice: 'Mia', speed: 1, durationS: 2.5, audio: 'narration/n1.mp3', speechMarks: null },
          { id: 'n2', startsAtS: 3, script: 'Sin voz', voice: null, speed: 1, durationS: 0, audio: null, speechMarks: null },
        ],
        pauses: [],
        audioClips: [],
      },
      { id: 's1', position: 1, type: 'cover', title: 'Portada', background: 'primary', durationS: 4, transition: 'none', advance: 'click', elements: [], narrationClips: [], pauses: [], audioClips: [] },
    ],
    media: { [IMAGE]: { path: `media/${IMAGE}/robot.png`, name: 'robot.png', mimeType: 'image/png', sizeBytes: 3 } },
    ...overrides,
  };
}

function lumia(content: Record<string, unknown>, files: Record<string, Uint8Array> = {}): Uint8Array {
  return zipSync({ 'definition.json': strToU8(JSON.stringify(content)), ...files });
}

function fakeUrls(): ObjectUrls & { created: string[]; revoked: string[] } {
  const created: string[] = [];
  const revoked: string[] = [];
  return {
    created,
    revoked,
    create: (blob) => {
      const url = `blob:demo/${String(created.length)}-${blob.type}`;
      created.push(url);
      return url;
    },
    revoke: (url) => {
      revoked.push(url);
    },
  };
}

describe('openLumia', () => {
  it('turns the definition into ordered slides with the media and narration as browser URLs', () => {
    const urls = fakeUrls();
    const files = { [`media/${IMAGE}/robot.png`]: new Uint8Array([1, 2, 3]), 'narration/n1.mp3': new Uint8Array([4, 5]) };
    const opened = openLumia(lumia(definition(), files), urls);
    expect(opened.displayName).toBe('Demo Video');
    expect(opened.slides.map((slide) => slide.title)).toEqual(['Portada', 'Segunda']);
    const [, second] = opened.slides;
    expect(second?.elements[0]).toMatchObject({ component: 'image', mediaId: IMAGE, props: { alt: 'Robot' }, media: { id: IMAGE, mimeType: 'image/png' } });
    expect(second?.elements[0]?.media?.url).toMatch(/^blob:demo\//);
    expect(second?.narrationClips).toMatchObject([
      { id: 'n1', status: 'ready', generatedDurationS: 2.5 },
      { id: 'n2', status: 'pending', audioUrl: null },
    ]);
    expect(opened.media(IMAGE)?.name).toBe('robot.png');
    opened.dispose();
    expect(urls.revoked).toEqual(urls.created);
    expect(urls.created).toHaveLength(2);
  });

  it('rejects files that are not a .lumia of this version', () => {
    expect(() => openLumia(new Uint8Array([1, 2, 3]), fakeUrls())).toThrow(LumiaFileError);
    expect(() => openLumia(zipSync({ 'otro.json': strToU8('{}') }), fakeUrls())).toThrow(/definition\.json/);
    expect(() => openLumia(lumia(definition({ formatVersion: 2 })), fakeUrls())).toThrow(/versión 1/);
  });
});

describe('demo source', () => {
  it('reads the path of the demo file, and only accepts paths of this site', async () => {
    const answer = (body: unknown, status = 200): Promise<Response> => Promise.resolve(new Response(JSON.stringify(body), { status }));
    await expect(demoFileUrl(() => answer({ file: '/demo-content/demo.lumia' }))).resolves.toBe('/demo-content/demo.lumia');
    await expect(demoFileUrl(() => answer({ file: 'https://otro.example/x.lumia' }))).rejects.toBeInstanceOf(DemoUnavailableError);
    await expect(demoFileUrl(() => answer({}, 404))).rejects.toBeInstanceOf(DemoUnavailableError);
  });

  it('says the demo is not available while the file is not in the bucket, and reports progress', async () => {
    await expect(download('/demo-content/demo.lumia', () => undefined, () => Promise.resolve(new Response('', { status: 403 })))).rejects.toBeInstanceOf(DemoUnavailableError);
    const seen: number[] = [];
    const body = new Uint8Array([1, 2, 3, 4]);
    const bytes = await download('/demo-content/demo.lumia', (fraction) => seen.push(fraction), () => Promise.resolve(new Response(body, { headers: { 'content-length': '4' } })));
    expect([...bytes]).toEqual([1, 2, 3, 4]);
    expect(seen.at(-1)).toBe(1);
  });
});
