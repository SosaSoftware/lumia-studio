import { z } from 'zod';
import { defineComponent } from '../component-definition.ts';
import { alignSchema, colorProp, emojiProp, flag, variantProp } from './shared.ts';

export const titleComponent = defineComponent({
  key: 'title',
  name: 'Título',
  group: 'text',
  usage: 'Título o encabezado de la diapositiva. Uno por diapositiva.',
  propsSchema: z.object({
    text: z.string().trim().min(1).max(120).describe('Texto del título'),
    level: z.enum(['h1', 'h2']).describe('h1 para el título principal de la clase, h2 para el resto'),
    align: alignSchema,
  }),
  defaults: { text: 'Título', level: 'h2', align: 'left' },
  defaultSize: { w: 88, h: 9 },
  fitsContent: true,
  usesMedia: false,
  isQuestion: false,
});

export const titleAnimatedComponent = defineComponent({
  key: 'title_animated',
  name: 'Título animado',
  group: 'text',
  usage: 'Título llamativo con degradado y entrada animada palabra por palabra. Ideal para portadas y aperturas de tema.',
  propsSchema: z.object({
    text: z.string().trim().min(1).max(120).describe('Texto del título'),
    level: z.enum(['h1', 'h2']).describe('h1 para el título principal de la clase, h2 para el resto'),
    align: alignSchema,
    effect: z.enum(['pop', 'rise', 'zoom', 'wave']).describe('Animación de entrada: pop (rebote), rise (sube), zoom o wave (ola continua)'),
    color: colorProp('primary', 'Color del título'),
    gradient: z.boolean().describe('Pintar el texto con el degradado del color'),
    underline: z.boolean().describe('Subrayado decorativo bajo el título'),
  }),
  defaults: { text: '¡Exploremos juntos!', level: 'h1', align: 'center', effect: 'pop', color: 'primary', gradient: true, underline: false },
  defaultSize: { w: 88, h: 11 },
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

export const paragraphHighlightComponent = defineComponent({
  key: 'paragraph_highlight',
  name: 'Párrafo con resaltados',
  group: 'text',
  usage: 'Párrafo con palabras o frases clave resaltadas para guiar la lectura. Lista en highlights las frases exactas a resaltar.',
  propsSchema: z.object({
    text: z.string().trim().min(1).max(1200).describe('Texto del párrafo'),
    highlights: z.array(z.string().trim().min(1).max(80)).max(8).describe('Palabras o frases del texto que se resaltan'),
    highlightStyle: z.enum(['marker', 'underline', 'pill', 'glow']).describe('Forma del resaltado: marker (marcador), underline (subrayado), pill (píldora) o glow (brillo)'),
    color: colorProp('warning', 'Color del resaltado'),
    align: alignSchema,
    size: z.enum(['sm', 'md', 'lg']).describe('Tamaño de letra'),
    animated: z.boolean().describe('Los resaltados se dibujan al aparecer'),
  }),
  defaults: {
    text: 'El sistema solar está formado por el Sol y los cuerpos celestes que giran a su alrededor, incluyendo ocho planetas y sus lunas.',
    highlights: ['sistema solar', 'ocho planetas'],
    highlightStyle: 'marker',
    color: 'warning',
    align: 'left',
    size: 'md',
    animated: true,
  },
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
    variant: z.enum(['cards', 'plain']).default('cards').describe('cards dibuja cada elemento como tarjeta; plain los deja como texto'),
    marker: z.enum(['dot', 'check', 'arrow', 'star']).default('dot').describe('Viñeta de las listas sin numerar'),
    color: colorProp('primary', 'Color de las viñetas y los números'),
    size: z.enum(['sm', 'md', 'lg']).default('md').describe('Tamaño de letra'),
  }),
  defaults: { items: ['Primer punto', 'Segundo punto'], ordered: false, variant: 'cards', marker: 'dot', color: 'primary', size: 'md' },
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
    emoji: emojiProp('', 'Emoji que reemplaza al ícono del tipo; vacío para usar el ícono'),
    variant: z.enum(['soft', 'solid', 'outline']).default('soft').describe('Estilo del destacado: soft (suave), solid (sólido) u outline (contorno)'),
    animated: flag(false, 'El ícono flota suavemente'),
  }),
  defaults: { title: '', text: 'Idea clave.', tone: 'key', emoji: '', variant: 'soft', animated: false },
  defaultSize: { w: 70, h: 12 },
  usesMedia: false,
  isQuestion: false,
});

export const quoteComponent = defineComponent({
  key: 'quote',
  name: 'Cita',
  group: 'text',
  usage: 'Cita o frase célebre con autor y fuente opcionales.',
  propsSchema: z.object({
    text: z.string().trim().min(1).max(400).describe('Texto de la cita'),
    author: z.string().trim().max(120).describe('Autor de la cita'),
    source: z.string().trim().max(120).describe('Fuente opcional: obra, año o lugar'),
    variant: z.enum(['editorial', 'card', 'bar']).describe('Estilo: editorial (comillas grandes), card (tarjeta) o bar (barra lateral)'),
    color: colorProp('accent', 'Color de las comillas y el acento'),
    align: alignSchema,
  }),
  defaults: { text: 'La imaginación es más importante que el conocimiento.', author: 'Albert Einstein', source: '', variant: 'editorial', color: 'accent', align: 'center' },
  defaultSize: { w: 70, h: 20 },
  fitsContent: true,
  usesMedia: false,
  isQuestion: false,
});

export const bannerComponent = defineComponent({
  key: 'banner',
  name: 'Banner',
  group: 'text',
  usage: 'Cinta o etiqueta llamativa para marcar una sección nueva, un reto o un aviso corto.',
  propsSchema: z.object({
    text: z.string().trim().min(1).max(80).describe('Texto del banner'),
    emoji: emojiProp('✨'),
    shape: z.enum(['ribbon', 'pill', 'tag']).describe('Forma: ribbon (cinta), pill (píldora) o tag (etiqueta)'),
    color: colorProp('pink'),
    variant: variantProp('gradient'),
    animated: z.boolean().describe('Brillo que recorre el banner'),
  }),
  defaults: { text: '¡Nuevo tema!', emoji: '✨', shape: 'ribbon', color: 'pink', variant: 'gradient', animated: true },
  defaultSize: { w: 40, h: 8 },
  usesMedia: false,
  isQuestion: false,
});

const stepSchema = z.object({
  title: z.string().trim().min(1).max(60).describe('Título del paso'),
  description: z.string().trim().max(200).describe('Descripción corta del paso'),
});

export const stepperComponent = defineComponent({
  key: 'stepper',
  name: 'Pasos',
  group: 'text',
  usage: 'Secuencia de 2 a 6 pasos numerados con el paso actual resaltado. Para procesos e instrucciones.',
  propsSchema: z.object({
    steps: z.array(stepSchema).min(2).max(6).describe('Pasos en orden'),
    current: z.number().int().min(0).max(6).describe('Número del paso actual; los anteriores se marcan como completados. 0 para no marcar ninguno'),
    orientation: z.enum(['horizontal', 'vertical']).describe('Dirección de los pasos'),
    color: colorProp('primary'),
    interactive: z.boolean().describe('El estudiante avanza por los pasos con un clic'),
  }),
  defaults: {
    steps: [
      { title: 'Observa', description: 'Mira con atención el fenómeno.' },
      { title: 'Pregunta', description: 'Formula una hipótesis.' },
      { title: 'Experimenta', description: 'Pon a prueba tu idea.' },
    ],
    current: 2,
    orientation: 'horizontal',
    color: 'primary',
    interactive: true,
  },
  defaultSize: { w: 84, h: 18 },
  fitsContent: true,
  usesMedia: false,
  isQuestion: false,
});

export const typewriterComponent = defineComponent({
  key: 'typewriter',
  name: 'Máquina de escribir',
  group: 'text',
  usage: 'Texto corto que se escribe letra por letra frente al estudiante. Para preguntas detonantes o revelaciones.',
  propsSchema: z.object({
    text: z.string().trim().min(1).max(300).describe('Texto que se escribe'),
    speed: z.enum(['slow', 'normal', 'fast']).describe('Velocidad de escritura'),
    loop: z.boolean().describe('Borrar y volver a escribir al terminar'),
    cursor: z.boolean().describe('Mostrar el cursor parpadeante'),
    size: z.enum(['sm', 'md', 'lg']).describe('Tamaño de letra'),
    align: alignSchema,
    color: colorProp('primary', 'Color del cursor y del texto'),
    mono: z.boolean().describe('Usar letra monoespaciada'),
  }),
  defaults: { text: '¿Qué pasaría si la Tierra dejara de girar?', speed: 'normal', loop: false, cursor: true, size: 'lg', align: 'left', color: 'primary', mono: false },
  defaultSize: { w: 80, h: 10 },
  fitsContent: true,
  usesMedia: false,
  isQuestion: false,
});

export const codeSnippetComponent = defineComponent({
  key: 'code_snippet',
  name: 'Bloque de código',
  group: 'text',
  usage: 'Fragmento de código con resaltado de sintaxis y números de línea. Para clases de programación.',
  propsSchema: z.object({
    code: z.string().min(1).max(2000).describe('Código a mostrar'),
    language: z.enum(['text', 'javascript', 'python', 'html', 'css', 'json', 'sql']).describe('Lenguaje del código'),
    title: z.string().trim().max(60).describe('Nombre del archivo o título; vacío para ocultarlo'),
    showLineNumbers: z.boolean().describe('Mostrar los números de línea'),
    highlightLines: z.string().trim().max(60).describe('Líneas a resaltar, por ejemplo 2,4-5; vacío para ninguna'),
    theme: z.enum(['dark', 'light']).describe('Tema del bloque'),
    size: z.enum(['sm', 'md', 'lg']).describe('Tamaño de letra'),
  }),
  defaults: {
    code: 'def saludar(nombre):\n    mensaje = "Hola, " + nombre\n    print(mensaje)\n\nsaludar("Lumia")',
    language: 'python',
    title: 'saludo.py',
    showLineNumbers: true,
    highlightLines: '',
    theme: 'dark',
    size: 'md',
  },
  defaultSize: { w: 60, h: 26 },
  fitsContent: true,
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
    columns: z.array(z.string().trim().min(1).max(100).describe('Nombre de la columna')).min(1).max(6).describe('Columnas de la tabla').meta({ control: 'table' }),
    rows: z.array(z.array(cellSchema).describe('Fila de celdas')).min(1).max(10).describe('Filas de la tabla').meta({ control: 'table' }),
    headerRow: z.boolean().describe('Mostrar la primera fila como encabezado'),
    color: colorProp('primary', 'Color del encabezado'),
    variant: variantProp('solid'),
    striped: flag(true, 'Alternar el fondo de las filas'),
    firstColumnBold: flag(true, 'Resaltar la primera columna'),
    align: z.enum(['left', 'center']).default('left').describe('Alineación de las celdas'),
    size: z.enum(['sm', 'md', 'lg']).default('md').describe('Tamaño de letra'),
  }),
  defaults: {
    columns: ['Columna 1', 'Columna 2', 'Columna 3'],
    rows: [
      ['Dato 1', 'Dato 2', 'Dato 3'],
      ['Dato 4', 'Dato 5', 'Dato 6'],
    ],
    headerRow: true,
    color: 'primary',
    variant: 'solid',
    striped: true,
    firstColumnBold: true,
    align: 'left',
    size: 'md',
  },
  defaultSize: { w: 80, h: 25 },
  fitsContent: true,
  usesMedia: false,
  isQuestion: false,
});
