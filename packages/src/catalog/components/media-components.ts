import { z } from 'zod';
import { defineComponent } from '../component-definition.ts';
import { ICON_NAMES } from '../icons.ts';
import { themeColorSchema } from '../theme-tokens.ts';

export const imageComponent = defineComponent({
  key: 'image',
  name: 'Imagen',
  group: 'media',
  usage: 'Imagen que apoya la explicación. Sin medio subido, describe en prompt la imagen que la persona debe agregar.',
  propsSchema: z.object({
    mediaId: z.uuid().nullable().describe('Id del medio subido, o null si falta subirlo'),
    alt: z.string().trim().min(1).max(200).describe('Texto alternativo'),
    prompt: z.string().trim().max(300).describe('Descripción de la imagen deseada cuando falta el medio'),
    caption: z.string().trim().max(160).describe('Pie de imagen opcional'),
    fit: z.enum(['cover', 'contain']).describe('Cómo se ajusta la imagen a su marco'),
  }),
  defaults: { mediaId: null, alt: 'Imagen', prompt: '', caption: '', fit: 'contain' },
  defaultSize: { w: 40, h: 30 },
  usesMedia: true,
  isQuestion: false,
});

export const videoComponent = defineComponent({
  key: 'video',
  name: 'Video',
  group: 'media',
  usage: 'Video corto. Sin medio subido, describe en prompt el video que la persona debe agregar.',
  propsSchema: z.object({
    mediaId: z.uuid().nullable().describe('Id del medio subido, o null si falta subirlo'),
    title: z.string().trim().min(1).max(120).describe('Título del video'),
    prompt: z.string().trim().max(300).describe('Descripción del video deseado cuando falta el medio'),
    startAtS: z.number().min(0).describe('Segundo en el que empieza'),
    autoplay: z.boolean().describe('Se reproduce al aparecer'),
  }),
  defaults: { mediaId: null, title: 'Video', prompt: '', startAtS: 0, autoplay: false },
  defaultSize: { w: 64, h: 36 },
  usesMedia: true,
  isQuestion: false,
});

export const audioComponent = defineComponent({
  key: 'audio',
  name: 'Audio',
  group: 'media',
  usage: 'Clip de audio. Sin medio subido, describe en prompt el audio que la persona debe agregar.',
  propsSchema: z.object({
    mediaId: z.uuid().nullable().describe('Id del medio subido, o null si falta subirlo'),
    title: z.string().trim().min(1).max(120).describe('Título del audio'),
    prompt: z.string().trim().max(300).describe('Descripción del audio deseado cuando falta el medio'),
    showControls: z.boolean().describe('Mostrar controles de reproducción'),
  }),
  defaults: { mediaId: null, title: 'Audio', prompt: '', showControls: true },
  defaultSize: { w: 50, h: 8 },
  usesMedia: true,
  isQuestion: false,
});

export const iconComponent = defineComponent({
  key: 'icon',
  name: 'Ícono',
  group: 'media',
  usage: 'Ícono decorativo del catálogo para acompañar texto o resaltar ideas.',
  propsSchema: z.object({
    name: z.enum(ICON_NAMES).describe('Nombre del ícono'),
    color: themeColorSchema,
    label: z.string().trim().max(80).describe('Etiqueta accesible del ícono'),
  }),
  defaults: { name: 'idea', color: 'accent', label: '' },
  defaultSize: { w: 8, h: 8 },
  usesMedia: false,
  isQuestion: false,
});

export const illustrationComponent = defineComponent({
  key: 'illustration',
  name: 'Ilustración',
  group: 'media',
  usage: 'Ilustración generada o subida. Describe en prompt el estilo y contenido deseado.',
  propsSchema: z.object({
    mediaId: z.uuid().nullable().describe('Id del medio subido, o null si falta subirlo'),
    alt: z.string().trim().min(1).max(200).describe('Texto alternativo'),
    prompt: z.string().trim().max(300).describe('Descripción de la ilustración deseada'),
    style: z.enum(['flat', 'line', 'photo']).describe('Estilo visual de la ilustración'),
  }),
  defaults: { mediaId: null, alt: 'Ilustración', prompt: '', style: 'flat' },
  defaultSize: { w: 40, h: 30 },
  usesMedia: true,
  isQuestion: false,
});
