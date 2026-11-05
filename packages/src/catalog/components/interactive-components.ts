import { z } from 'zod';
import { defineComponent } from '../component-definition.ts';

export const flipCardComponent = defineComponent({
  key: 'flip_card',
  name: 'Tarjeta que se voltea',
  group: 'interactive',
  usage: 'Pregunta o concepto al frente y respuesta o definición atrás; el estudiante la voltea.',
  propsSchema: z.object({
    front: z.string().trim().min(1).max(200).describe('Texto del frente'),
    back: z.string().trim().min(1).max(400).describe('Texto del reverso'),
  }),
  defaults: { front: 'Concepto', back: 'Definición' },
  defaultSize: { w: 30, h: 20 },
  usesMedia: false,
  isQuestion: false,
});

export const buttonLinkComponent = defineComponent({
  key: 'button_link',
  name: 'Botón o enlace',
  group: 'interactive',
  usage: 'Botón que navega a otra diapositiva o abre una URL externa.',
  propsSchema: z.object({
    label: z.string().trim().min(1).max(80).describe('Texto del botón'),
    action: z.enum(['next_slide', 'go_to_slide', 'open_url']).describe('Acción al hacer clic'),
    target: z.string().trim().max(500).describe('Destino: número de diapositiva o URL'),
  }),
  defaults: { label: 'Continuar', action: 'next_slide', target: '' },
  defaultSize: { w: 20, h: 6 },
  usesMedia: false,
  isQuestion: false,
});

export const hotspotComponent = defineComponent({
  key: 'hotspot',
  name: 'Punto interactivo',
  group: 'interactive',
  usage: 'Punto que al hacer clic muestra contenido oculto. Ideal sobre imágenes.',
  propsSchema: z.object({
    label: z.string().trim().min(1).max(80).describe('Etiqueta del punto'),
    content: z.string().trim().min(1).max(500).describe('Contenido que se muestra al hacer clic'),
  }),
  defaults: { label: 'Ver más', content: 'Contenido del punto interactivo.' },
  defaultSize: { w: 8, h: 8 },
  usesMedia: false,
  isQuestion: false,
});

const tabSchema = z.object({
  title: z.string().trim().min(1).max(80).describe('Título de la pestaña'),
  content: z.string().trim().min(1).max(600).describe('Contenido de la pestaña'),
});

export const tabsComponent = defineComponent({
  key: 'tabs',
  name: 'Pestañas',
  group: 'interactive',
  usage: 'Contenido organizado en pestañas. De 2 a 5 pestañas.',
  propsSchema: z.object({
    tabs: z.array(tabSchema).min(2).max(5).describe('Pestañas'),
  }),
  defaults: {
    tabs: [
      { title: 'Pestaña 1', content: 'Contenido de la primera pestaña.' },
      { title: 'Pestaña 2', content: 'Contenido de la segunda pestaña.' },
    ],
  },
  defaultSize: { w: 80, h: 30 },
  usesMedia: false,
  isQuestion: false,
});

const sectionSchema = z.object({
  title: z.string().trim().min(1).max(80).describe('Título de la sección'),
  content: z.string().trim().min(1).max(600).describe('Contenido de la sección'),
});

export const accordionComponent = defineComponent({
  key: 'accordion',
  name: 'Acordeón',
  group: 'interactive',
  usage: 'Secciones colapsables. De 2 a 6 secciones.',
  propsSchema: z.object({
    sections: z.array(sectionSchema).min(2).max(6).describe('Secciones del acordeón'),
  }),
  defaults: {
    sections: [
      { title: 'Sección 1', content: 'Contenido de la primera sección.' },
      { title: 'Sección 2', content: 'Contenido de la segunda sección.' },
    ],
  },
  defaultSize: { w: 80, h: 30 },
  usesMedia: false,
  isQuestion: false,
});

const galleryItemSchema = z.object({
  mediaId: z.uuid().nullable().describe('Id del medio subido, o null si falta subirlo'),
  alt: z.string().trim().min(1).max(200).describe('Texto alternativo'),
  caption: z.string().trim().max(160).describe('Pie de imagen opcional'),
});

export const galleryComponent = defineComponent({
  key: 'gallery',
  name: 'Galería',
  group: 'interactive',
  usage: 'Galería de imágenes con navegación. De 2 a 8 elementos.',
  propsSchema: z.object({
    items: z.array(galleryItemSchema).min(2).max(8).describe('Elementos de la galería'),
  }),
  defaults: {
    items: [
      { mediaId: null, alt: 'Imagen 1', caption: '' },
      { mediaId: null, alt: 'Imagen 2', caption: '' },
    ],
  },
  defaultSize: { w: 80, h: 35 },
  usesMedia: true,
  isQuestion: false,
});

const timelineEventSchema = z.object({
  label: z.string().trim().min(1).max(80).describe('Etiqueta del evento'),
  description: z.string().trim().min(1).max(300).describe('Descripción del evento'),
});

export const timelineComponentDef = defineComponent({
  key: 'timeline_component',
  name: 'Línea de tiempo',
  group: 'interactive',
  usage: 'Secuencia cronológica de eventos. De 2 a 8 eventos.',
  propsSchema: z.object({
    events: z.array(timelineEventSchema).min(2).max(8).describe('Eventos de la línea de tiempo'),
  }),
  defaults: {
    events: [
      { label: 'Evento 1', description: 'Descripción del primer evento.' },
      { label: 'Evento 2', description: 'Descripción del segundo evento.' },
    ],
  },
  defaultSize: { w: 80, h: 25 },
  usesMedia: false,
  isQuestion: false,
});

export const timerComponent = defineComponent({
  key: 'timer',
  name: 'Temporizador',
  group: 'interactive',
  usage: 'Cuenta regresiva para actividades cronometradas.',
  propsSchema: z.object({
    seconds: z.number().int().min(5).max(600).describe('Duración en segundos'),
    label: z.string().trim().max(80).describe('Etiqueta del temporizador'),
    autoStart: z.boolean().describe('Iniciar automáticamente'),
  }),
  defaults: { seconds: 60, label: '', autoStart: false },
  defaultSize: { w: 20, h: 20 },
  usesMedia: false,
  isQuestion: false,
});
