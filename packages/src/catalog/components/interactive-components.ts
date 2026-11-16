import { z } from 'zod';
import { defineComponent } from '../component-definition.ts';
import { colorProp, emojiProp, flag, variantProp } from './shared.ts';

export const flipCardComponent = defineComponent({
  key: 'flip_card',
  name: 'Tarjeta que se voltea',
  group: 'interactive',
  usage: 'Pregunta o concepto al frente y respuesta o definición atrás; el estudiante la voltea.',
  propsSchema: z.object({
    front: z.string().trim().min(1).max(200).describe('Texto del frente'),
    back: z.string().trim().min(1).max(400).describe('Texto del reverso'),
    frontLabel: z.string().trim().max(30).default('Pregunta').describe('Etiqueta pequeña del frente; vacío para ocultarla'),
    backLabel: z.string().trim().max(30).default('Respuesta').describe('Etiqueta pequeña del reverso; vacío para ocultarla'),
    emoji: emojiProp('', 'Emoji grande del frente; vacío para no mostrarlo'),
    color: colorProp('primary', 'Color del reverso'),
    variant: variantProp('gradient'),
    axis: z.enum(['horizontal', 'vertical']).default('horizontal').describe('Eje del giro'),
  }),
  defaults: { front: 'Concepto', back: 'Definición', frontLabel: 'Pregunta', backLabel: 'Respuesta', emoji: '', color: 'primary', variant: 'gradient', axis: 'horizontal' },
  defaultSize: { w: 30, h: 20 },
  usesMedia: false,
  isQuestion: false,
});

export const buttonLinkComponent = defineComponent({
  key: 'button_link',
  name: 'Botón o enlace',
  group: 'interactive',
  usage:
    'Botón que avanza a la siguiente diapositiva, va a otra diapositiva, inicia su diapositiva (start_slide: la diapositiva espera a que el estudiante lo presione) o abre una URL externa.',
  propsSchema: z.object({
    label: z.string().trim().min(1).max(80).describe('Texto del botón'),
    action: z
      .enum(['next_slide', 'go_to_slide', 'start_slide', 'open_url'])
      .describe('Acción al hacer clic: next_slide (siguiente diapositiva), go_to_slide (ir a una diapositiva), start_slide (iniciar su diapositiva) u open_url (abrir un enlace)'),
    target: z
      .string()
      .trim()
      .max(500)
      .describe('Destino: con go_to_slide, el número de la diapositiva; con open_url, la URL. Vacío con las demás acciones')
      .meta({ ref: { slides: true, when: { prop: 'action', value: 'go_to_slide' } } }),
    emoji: emojiProp('', 'Emoji antes del texto; vacío para no mostrarlo'),
    color: colorProp('primary'),
    variant: z.enum(['gradient', 'solid', 'soft', 'outline']).default('gradient').describe('Estilo: gradient (degradado), solid (sólido), soft (suave) u outline (contorno)'),
    shape: z.enum(['rounded', 'pill']).default('pill').describe('Forma del botón'),
    pulse: flag(false, 'Pulso suave que invita a hacer clic'),
  }),
  defaults: { label: 'Continuar', action: 'next_slide', target: '', emoji: '', color: 'primary', variant: 'gradient', shape: 'pill', pulse: false },
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
    side: z.enum(['top', 'bottom', 'left', 'right']).optional().describe('Lado del punto donde aparece el contenido; si se omite, a la derecha'),
    marker: z.enum(['number', 'plus', 'info', 'question', 'emoji']).default('number').describe('Qué muestra el punto: number (número), plus (+), info (i), question (?) o emoji'),
    emoji: emojiProp('📍', 'Emoji del punto cuando el marcador es emoji'),
    color: colorProp('primary'),
    pulse: flag(true, 'Ondas que llaman la atención mientras está cerrado'),
  }),
  defaults: { label: 'Ver más', content: 'Contenido del punto interactivo.', side: 'right', marker: 'number', emoji: '📍', color: 'primary', pulse: true },
  defaultSize: { w: 8, h: 8 },
  usesMedia: false,
  isQuestion: false,
});

const tabSchema = z.object({
  title: z.string().trim().min(1).max(80).describe('Título de la pestaña'),
  content: z.string().trim().min(1).max(600).describe('Contenido de la pestaña'),
  emoji: emojiProp('', 'Emoji de la pestaña; vacío para no mostrarlo'),
});

export const tabsComponent = defineComponent({
  key: 'tabs',
  name: 'Pestañas',
  group: 'interactive',
  usage: 'Contenido organizado en pestañas. De 2 a 5 pestañas.',
  propsSchema: z.object({
    tabs: z.array(tabSchema).min(2).max(5).describe('Pestañas'),
    style: z.enum(['pills', 'underline', 'cards']).default('pills').describe('Estilo de las pestañas: pills (píldoras), underline (subrayado) o cards (tarjetas)'),
    color: colorProp('primary'),
  }),
  defaults: {
    tabs: [
      { title: 'Pestaña 1', content: 'Contenido de la primera pestaña.', emoji: '' },
      { title: 'Pestaña 2', content: 'Contenido de la segunda pestaña.', emoji: '' },
    ],
    style: 'pills',
    color: 'primary',
  },
  defaultSize: { w: 80, h: 30 },
  usesMedia: false,
  isQuestion: false,
});

const sectionSchema = z.object({
  title: z.string().trim().min(1).max(80).describe('Título de la sección'),
  content: z.string().trim().min(1).max(600).describe('Contenido de la sección'),
  emoji: emojiProp('', 'Emoji de la sección; vacío para no mostrarlo'),
});

export const accordionComponent = defineComponent({
  key: 'accordion',
  name: 'Acordeón',
  group: 'interactive',
  usage: 'Secciones colapsables. De 2 a 6 secciones.',
  propsSchema: z.object({
    sections: z.array(sectionSchema).min(2).max(6).describe('Secciones del acordeón'),
    style: z.enum(['cards', 'list']).default('cards').describe('Estilo: cards (tarjetas separadas) o list (lista continua)'),
    color: colorProp('primary'),
    multiple: flag(true, 'Permitir varias secciones abiertas a la vez'),
    firstOpen: flag(true, 'La primera sección empieza abierta'),
  }),
  defaults: {
    sections: [
      { title: 'Sección 1', content: 'Contenido de la primera sección.', emoji: '' },
      { title: 'Sección 2', content: 'Contenido de la segunda sección.', emoji: '' },
    ],
    style: 'cards',
    color: 'primary',
    multiple: true,
    firstOpen: true,
  },
  defaultSize: { w: 80, h: 30 },
  fitsContent: true,
  usesMedia: false,
  isQuestion: false,
});

const timelineEventSchema = z.object({
  label: z.string().trim().min(1).max(80).describe('Etiqueta del evento'),
  description: z.string().trim().min(1).max(300).describe('Descripción del evento'),
  emoji: emojiProp('', 'Emoji del evento; vacío para mostrar un punto'),
});

export const timelineComponentDef = defineComponent({
  key: 'timeline_component',
  name: 'Línea de tiempo',
  group: 'interactive',
  usage: 'Secuencia cronológica de 2 a 8 eventos, horizontal o vertical.',
  propsSchema: z.object({
    events: z.array(timelineEventSchema).min(2).max(8).describe('Eventos de la línea de tiempo'),
    orientation: z.enum(['horizontal', 'vertical']).default('horizontal').describe('Dirección de la línea'),
    color: colorProp('primary'),
    colorful: flag(true, 'Pintar cada evento de un color distinto'),
    animated: flag(true, 'Los eventos aparecen en secuencia'),
  }),
  defaults: {
    events: [
      { label: 'Evento 1', description: 'Descripción del primer evento.', emoji: '' },
      { label: 'Evento 2', description: 'Descripción del segundo evento.', emoji: '' },
    ],
    orientation: 'horizontal',
    color: 'primary',
    colorful: true,
    animated: true,
  },
  defaultSize: { w: 80, h: 25 },
  fitsContent: true,
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
    style: z.enum(['ring', 'digital']).default('ring').describe('Estilo: ring (anillo) o digital (números grandes)'),
    color: colorProp('warning'),
    showControls: flag(true, 'Mostrar los botones de iniciar y reiniciar'),
  }),
  defaults: { seconds: 60, label: '', autoStart: false, style: 'ring', color: 'warning', showControls: true },
  defaultSize: { w: 20, h: 20 },
  usesMedia: false,
  isQuestion: false,
});

const gridItemSchema = z.object({
  emoji: emojiProp('⭐', 'Emoji de la tarjeta'),
  title: z.string().trim().min(1).max(60).describe('Título de la tarjeta'),
  text: z.string().trim().max(200).describe('Texto de la tarjeta'),
  wide: z.boolean().describe('La tarjeta ocupa dos columnas'),
});

export const contentGridComponent = defineComponent({
  key: 'content_grid',
  name: 'Cuadrícula de tarjetas',
  group: 'interactive',
  usage: 'De 2 a 9 tarjetas con emoji, título y texto en cuadrícula. Para conceptos, ejemplos o categorías.',
  propsSchema: z.object({
    items: z.array(gridItemSchema).min(2).max(9).describe('Tarjetas'),
    columns: z.number().int().min(1).max(4).describe('Número de columnas'),
    color: colorProp('primary'),
    variant: variantProp('soft'),
    colorful: z.boolean().describe('Pintar cada tarjeta de un color distinto'),
    animated: z.boolean().describe('Las tarjetas aparecen en secuencia'),
  }),
  defaults: {
    items: [
      { emoji: '🌞', title: 'El Sol', text: 'Estrella en el centro del sistema.', wide: true },
      { emoji: '🪐', title: 'Planetas', text: 'Ocho mundos que lo orbitan.', wide: false },
      { emoji: '⭐', title: 'Estrellas', text: 'Soles lejanos.', wide: false },
      { emoji: '🌕', title: 'Satélites', text: 'Lunas que orbitan planetas.', wide: true },
    ],
    columns: 3,
    color: 'primary',
    variant: 'soft',
    colorful: true,
    animated: true,
  },
  defaultSize: { w: 70, h: 34 },
  usesMedia: false,
  isQuestion: false,
});

export const rouletteComponent = defineComponent({
  key: 'roulette',
  name: 'Ruleta',
  group: 'interactive',
  usage: 'Ruleta de 2 a 10 opciones que el estudiante gira para elegir un tema, un reto o un turno al azar.',
  propsSchema: z.object({
    options: z.array(z.string().trim().min(1).max(30)).min(2).max(10).describe('Opciones de la ruleta'),
    spinS: z.number().min(1).max(10).describe('Segundos que dura el giro'),
    buttonLabel: z.string().trim().min(1).max(30).describe('Texto del botón'),
    colorful: z.boolean().describe('Cada opción de un color distinto; si no, alterna dos tonos del color'),
    color: colorProp('primary'),
  }),
  defaults: { options: ['Mercurio', 'Venus', 'Tierra', 'Marte', 'Júpiter', 'Saturno'], spinS: 4, buttonLabel: 'Girar', colorful: true, color: 'primary' },
  defaultSize: { w: 30, h: 44 },
  usesMedia: false,
  isQuestion: false,
});

export const diceComponent = defineComponent({
  key: 'dice',
  name: 'Dado',
  group: 'interactive',
  usage: 'Uno o dos dados que el estudiante lanza con un clic. Para juegos, turnos o problemas de probabilidad.',
  propsSchema: z.object({
    count: z.number().int().min(1).max(2).describe('Cantidad de dados'),
    faces: z.array(z.string().trim().min(1).max(12)).max(6).describe('Caras personalizadas (hasta 6); vacío para usar los puntos del 1 al 6'),
    color: colorProp('danger'),
    showTotal: z.boolean().describe('Mostrar la suma de los dados'),
  }),
  defaults: { count: 1, faces: [], color: 'danger', showTotal: true },
  defaultSize: { w: 18, h: 22 },
  usesMedia: false,
  isQuestion: false,
});

export const scratchCardComponent = defineComponent({
  key: 'scratch_card',
  name: 'Rasca y descubre',
  group: 'interactive',
  usage: 'Contenido oculto bajo una capa que el estudiante raspa con el cursor o el dedo para descubrirlo.',
  propsSchema: z.object({
    emoji: emojiProp('🎁', 'Emoji del contenido oculto'),
    title: z.string().trim().min(1).max(60).describe('Título del contenido oculto'),
    text: z.string().trim().max(200).describe('Texto del contenido oculto'),
    coverLabel: z.string().trim().max(40).describe('Texto sobre la capa'),
    coverColor: colorProp('muted', 'Color de la capa que se raspa'),
    color: colorProp('purple', 'Color del contenido oculto'),
    brush: z.enum(['sm', 'md', 'lg']).describe('Tamaño del raspado'),
    revealAt: z.number().int().min(20).max(90).describe('Porcentaje raspado a partir del cual se descubre todo'),
  }),
  defaults: { emoji: '🎁', title: '¡Sorpresa!', text: 'Júpiter es tan grande que caben 1 300 Tierras dentro.', coverLabel: 'Rasca aquí', coverColor: 'muted', color: 'purple', brush: 'md', revealAt: 55 },
  defaultSize: { w: 36, h: 22 },
  usesMedia: false,
  isQuestion: false,
});
