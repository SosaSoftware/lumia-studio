import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { DocumentVersionDto } from '../domain/dto.ts';
import type { ExportSource } from '../repositories/export-repository.ts';
import { DEFINITION_FILE, buildArchive, buildDefinition, exportKey, referencedMedia, slug } from './lumia-archive.ts';

const IMAGE = '3f2b8f0e-6a1d-4c57-9e1a-2d6a4b0c9f11';
const PHOTO = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const SONG = '9b2f1c3a-1111-4c57-9e1a-2d6a4b0c9f22';

const source: ExportSource = {
  versionId: 'v-1',
  documentId: 'd-1',
  nodeId: 'n-1',
  number: 3,
  status: 'published',
  publishedAt: '2026-11-05T01:00:00Z',
  publishedBy: 'dev:creadora@studio.test',
  node: { name: 'que-es-la-ia.lumia', displayName: '¿Qué es la IA?', description: '' },
  category: { name: 'academia-lumia', displayName: 'Academia Lumia', groupName: 'Academias' },
  subcategory: { name: 'inteligencia-artificial', displayName: 'Inteligencia artificial', groupName: 'Educación Básica' },
  folders: [{ name: 'fundamentos', displayName: 'Fundamentos' }],
};

const version: DocumentVersionDto = {
  id: 'v-1',
  documentId: 'd-1',
  number: 3,
  status: 'published',
  createdAt: '2026-11-04T00:00:00Z',
  createdBy: 'dev:creadora@studio.test',
  publishedAt: '2026-11-05T01:00:00Z',
  publishedBy: 'dev:creadora@studio.test',
  slides: [
    {
      id: 's-1',
      versionId: 'v-1',
      position: 1,
      title: 'Portada',
      background: 'surface',
      durationS: 8,
      transition: 'none',
      advance: 'click',
      elements: [
        { id: 'e-1', slideId: 's-1', component: 'image', name: 'Imagen', x: 0, y: 0, w: 10, h: 10, z: 1, appearsAtS: 0, entrance: 'none', props: { mediaId: IMAGE, alt: 'Robot' }, mediaId: IMAGE, media: null },
        { id: 'e-2', slideId: 's-1', component: 'gallery', name: 'Galería', x: 0, y: 0, w: 10, h: 10, z: 2, appearsAtS: 0, entrance: 'none', props: { items: [{ mediaId: PHOTO }, { mediaId: null }] }, mediaId: null, media: null },
      ],
      narrationClips: [
        { id: 'c-1', slideId: 's-1', startsAtS: 0, script: 'Hola', voice: 'Mia', speed: 1, generatedDurationS: 2.5, audioUrl: 'x', speechMarksUrl: 'y', status: 'ready', errorMessage: null },
        { id: 'c-2', slideId: 's-1', startsAtS: 3, script: 'Sin voz', voice: null, speed: 1, generatedDurationS: 0, audioUrl: null, speechMarksUrl: null, status: 'pending', errorMessage: null },
      ],
      pauses: [],
      audioClips: [{ id: 'a-1', slideId: 's-1', mediaId: SONG, media: null, startsAtS: 0, durationS: 8, name: 'Fondo', kind: 'music', volume: 0.4 }],
      comments: [{ id: 'k-1', slideId: 's-1', authorSub: 'x', authorName: 'Carlos Sosa', body: 'Revisar', createdAt: '2026-11-04T00:00:00Z' }],
    },
  ],
};

describe('.lumia export', () => {
  it('places the class at a path of the tree, with the groups joined to the names', () => {
    expect(slug('Educación Básica')).toBe('educacion-basica');
    expect(exportKey(source)).toBe('academias-academia-lumia/educacion-basica-inteligencia-artificial/fundamentos/que-es-la-ia.lumia');
    const ungrouped = { ...source, category: { ...source.category, groupName: null }, subcategory: { ...source.subcategory, groupName: '¡!' }, folders: [] };
    expect(exportKey(ungrouped)).toBe('academia-lumia/inteligencia-artificial/que-es-la-ia.lumia');
  });

  it('lists the media of the components, gallery items and audio clips', () => {
    expect(referencedMedia(version)).toEqual([IMAGE, PHOTO, SONG].sort());
  });

  it('writes definition.json with the content, the media paths and no comments, and zips the files', () => {
    const media = [
      { id: IMAGE, key: `media/c/${IMAGE}/robot.png`, name: 'robot.png', mimeType: 'image/png', sizeBytes: 3 },
      { id: SONG, key: `media/c/${SONG}/fondo.mp3`, name: 'Fondo musical.mp3', mimeType: 'audio/mpeg', sizeBytes: 4 },
    ];
    const narration = [{ id: 'c-1', audioKey: 'narration/d-1/c-1.mp3', speechMarksKey: 'narration/d-1/c-1.marks.json' }];
    const definition = buildDefinition(source, version, media, narration, new Date('2026-11-05T02:00:00Z'));
    expect(definition).toMatchObject({ format: 'lumia', formatVersion: 1, class: { name: 'que-es-la-ia.lumia', folders: [{ name: 'fundamentos' }] }, version: { number: 3 } });
    expect(definition.media).toEqual({
      [IMAGE]: { path: `media/${IMAGE}/robot.png`, name: 'robot.png', mimeType: 'image/png', sizeBytes: 3 },
      [SONG]: { path: `media/${SONG}/fondo.mp3`, name: 'Fondo musical.mp3', mimeType: 'audio/mpeg', sizeBytes: 4 },
    });
    expect(JSON.stringify(definition)).not.toContain('Revisar');
    const [slide] = definition.slides as { elements: { props: unknown }[]; narrationClips: unknown[] }[];
    expect(slide?.elements[0]?.props).toEqual({ mediaId: IMAGE, alt: 'Robot' });
    expect(slide?.narrationClips).toEqual([
      expect.objectContaining({ id: 'c-1', audio: 'narration/c-1.mp3', speechMarks: 'narration/c-1.marks.json', durationS: 2.5 }),
      expect.objectContaining({ id: 'c-2', audio: null, speechMarks: null }),
    ]);

    const zip = unzipSync(buildArchive(definition, [{ path: `media/${IMAGE}/robot.png`, body: new Uint8Array([1, 2, 3]) }]));
    expect(Object.keys(zip).sort()).toEqual([DEFINITION_FILE, `media/${IMAGE}/robot.png`]);
    expect(JSON.parse(strFromU8(zip[DEFINITION_FILE] ?? new Uint8Array()))).toEqual(definition);
    expect([...(zip[`media/${IMAGE}/robot.png`] ?? [])]).toEqual([1, 2, 3]);
  });
});
