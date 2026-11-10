import { z } from 'zod';
import { defineComponent } from '../component-definition.ts';

const alignSchema = z.enum(['left', 'center', 'right']).describe('Alineación del texto');

export const titleComponent = defineComponent({
  key: 'title',
  name: 'Título',
  group: 'text',
  usage: 'Título o encabezado de la diapositiva. Uno por diapositiva.',
  propsSchema: z.object({
    text: z.string().trim().min(1).max(120).describe('Texto del título'),
    level: z.enum(['h1', 'h2']).describe('h1 para portada y cierre, h2 para el resto'),
    align: alignSchema,
  }),
  defaults: { text: 'Título', level: 'h2', align: 'left' },
  defaultSize: { w: 88, h: 9 },
  fitsContent: true,
  usesMedia: false,
  isQuestion: false,
});

export const paragraphComponent = defineComponent({
  key: 'paragraph',
  name: 'Párrafo',
  group: 'text',
  usage: 'Explicación breve en prosa. Máximo 3 o 4 oraciones claras.',
  propsSchema: z.object({
    text: z.string().trim().min(1).max(1200).describe('Texto del párrafo'),
    align: alignSchema,
    size: z.enum(['sm', 'md', 'lg']).describe('Tamaño de letra'),
  }),
  defaults: { text: 'Escribe aquí el contenido.', align: 'left', size: 'md' },
  defaultSize: { w: 88, h: 18 },
  fitsContent: true,
  usesMedia: false,
  isQuestion: false,
});

export const bulletListComponent = defineComponent({
  key: 'bullet_list',
  name: 'Lista',
  group: 'text',
  usage: 'Puntos clave, pasos o ejemplos. De 2 a 6 elementos cortos.',
  propsSchema: z.object({
    items: z.array(z.string().trim().min(1).max(200)).min(1).max(8).describe('Elementos de la lista'),
    ordered: z.boolean().describe('true para pasos numerados'),
  }),
  defaults: { items: ['Primer punto', 'Segundo punto'], ordered: false },
  defaultSize: { w: 88, h: 22 },
  fitsContent: true,
  usesMedia: false,
  isQuestion: false,
});

export const calloutComponent = defineComponent({
  key: 'callout',
  name: 'Destacado',
  group: 'text',
  usage: 'Idea clave, consejo, advertencia o dato importante que debe resaltar.',
  propsSchema: z.object({
    title: z.string().trim().max(80).describe('Título corto opcional'),
    text: z.string().trim().min(1).max(400).describe('Texto del destacado'),
    tone: z.enum(['info', 'tip', 'warning', 'key']).describe('info, tip (consejo), warning (atención) o key (idea clave)'),
  }),
  defaults: { title: '', text: 'Idea clave.', tone: 'key' },
  defaultSize: { w: 70, h: 12 },
  usesMedia: false,
  isQuestion: false,
});

const cellSchema = z.string().trim().max(200).describe('Contenido de la celda');

export const tableComponent = defineComponent({
  key: 'table',
  name: 'Tabla',
  group: 'text',
  usage: 'Tabla para organizar datos en columnas y filas. De 1 a 6 columnas y 1 a 10 filas.',
  propsSchema: z.object({
    columns: z.array(z.string().trim().min(1).max(100).describe('Nombre de la columna')).min(1).max(6).describe('Columnas de la tabla'),
    rows: z.array(z.array(cellSchema).describe('Fila de celdas')).min(1).max(10).describe('Filas de la tabla'),
    headerRow: z.boolean().describe('Mostrar la primera fila como encabezado'),
  }),
  defaults: {
    columns: ['Columna 1', 'Columna 2', 'Columna 3'],
    rows: [
      ['Dato 1', 'Dato 2', 'Dato 3'],
      ['Dato 4', 'Dato 5', 'Dato 6'],
    ],
    headerRow: true,
  },
  defaultSize: { w: 80, h: 25 },
  fitsContent: true,
  usesMedia: false,
  isQuestion: false,
});
