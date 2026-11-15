import { z } from 'zod';
import { defineComponent } from '../component-definition.ts';
import { attemptsSchema, feedbackSchema, questionLookShape } from './shared.ts';

const optionSchema = z.object({
  id: z.string().trim().min(1).max(8).describe('Id corto de la opción, por ejemplo a, b, c').meta({ auto: true }),
  text: z.string().trim().min(1).max(200).describe('Texto de la opción'),
});

export const multipleChoiceComponent = defineComponent({
  key: 'multiple_choice',
  name: 'Opción múltiple',
  group: 'questions',
  usage: 'Pregunta con 2 a 6 opciones y una sola respuesta correcta, con retroalimentación.',
  propsSchema: z
    .object({
      question: z.string().trim().min(1).max(300).describe('Pregunta'),
      options: z.array(optionSchema).min(2).max(6).describe('Opciones'),
      columns: z.number().int().min(1).max(2).default(2).describe('Columnas de las opciones'),
      correctOptionId: z.string().trim().min(1).max(8).describe('Id de la opción correcta').meta({ ref: { list: 'options', value: 'id', label: 'text', letters: true } }),
      feedbackCorrect: feedbackSchema.describe('Retroalimentación cuando acierta'),
      feedbackIncorrect: feedbackSchema.describe('Retroalimentación cuando se equivoca'),
      attempts: attemptsSchema,
      ...questionLookShape,
    })
    .refine((props) => new Set(props.options.map((option) => option.id)).size === props.options.length, {
      message: 'Los ids de las opciones deben ser únicos.',
      path: ['options'],
    })
    .refine((props) => props.options.some((option) => option.id === props.correctOptionId), {
      message: 'correctOptionId debe ser el id de una de las opciones.',
      path: ['correctOptionId'],
    }),
  defaults: {
    question: '¿Cuál es la respuesta correcta?',
    options: [
      { id: 'a', text: 'Opción A' },
      { id: 'b', text: 'Opción B' },
    ],
    columns: 2,
    correctOptionId: 'a',
    feedbackCorrect: '¡Correcto!',
    feedbackIncorrect: 'Revisa de nuevo la explicación.',
    attempts: 2,
    color: 'primary',
    confetti: true,
  },
  defaultSize: { w: 88, h: 32 },
  fitsContent: true,
  usesMedia: false,
  isQuestion: true,
});

export const trueFalseComponent = defineComponent({
  key: 'true_false',
  name: 'Verdadero o falso',
  group: 'questions',
  usage: 'Afirmación que el estudiante marca como verdadera o falsa, con retroalimentación.',
  propsSchema: z.object({
    statement: z.string().trim().min(1).max(300).describe('Afirmación'),
    answer: z.boolean().describe('true si la afirmación es verdadera'),
    trueLabel: z.string().trim().max(20).default('Verdadero').describe('Texto del botón verdadero'),
    falseLabel: z.string().trim().max(20).default('Falso').describe('Texto del botón falso'),
    feedbackCorrect: feedbackSchema.describe('Retroalimentación cuando acierta'),
    feedbackIncorrect: feedbackSchema.describe('Retroalimentación cuando se equivoca'),
    attempts: attemptsSchema,
    ...questionLookShape,
  }),
  defaults: {
    statement: 'Escribe aquí la afirmación.',
    answer: true,
    trueLabel: 'Verdadero',
    falseLabel: 'Falso',
    feedbackCorrect: '¡Correcto!',
    feedbackIncorrect: 'Revisa de nuevo la explicación.',
    attempts: 1,
    color: 'primary',
    confetti: true,
  },
  defaultSize: { w: 88, h: 20 },
  usesMedia: false,
  isQuestion: true,
});

export const fillBlankComponent = defineComponent({
  key: 'fill_blank',
  name: 'Completar',
  group: 'questions',
  usage: 'Texto con espacios en blanco marcados con [[respuesta]] que el estudiante debe rellenar.',
  propsSchema: z
    .object({
      text: z.string().trim().min(1).max(600).describe('Texto con [[respuesta]] para los espacios en blanco'),
      caseSensitive: z.boolean().describe('Distinguir mayúsculas y minúsculas'),
      feedbackCorrect: feedbackSchema.describe('Retroalimentación cuando acierta'),
      feedbackIncorrect: feedbackSchema.describe('Retroalimentación cuando se equivoca'),
      attempts: attemptsSchema,
      ...questionLookShape,
    })
    .refine((props) => /\[\[.+?\]\]/.test(props.text), {
      message: 'El texto debe contener al menos un espacio en blanco con la forma [[respuesta]].',
      path: ['text'],
    }),
  defaults: {
    text: 'El agua hierve a [[100]] grados centígrados.',
    caseSensitive: false,
    feedbackCorrect: '¡Correcto!',
    feedbackIncorrect: 'Revisa de nuevo la explicación.',
    attempts: 2,
    color: 'primary',
    confetti: true,
  },
  defaultSize: { w: 80, h: 20 },
  fitsContent: true,
  usesMedia: false,
  isQuestion: true,
});

const dragItemSchema = z.object({
  id: z.string().trim().min(1).max(20).describe('Id único del elemento').meta({ auto: true }),
  text: z.string().trim().min(1).max(200).describe('Texto del elemento'),
});

const dragTargetSchema = z.object({
  id: z.string().trim().min(1).max(20).describe('Id único del destino').meta({ auto: true }),
  text: z.string().trim().min(1).max(200).describe('Texto del destino'),
  correctItemId: z.string().trim().min(1).max(20).describe('Id del elemento correcto').meta({ ref: { list: 'items', value: 'id', label: 'text' } }),
});

export const dragDropComponent = defineComponent({
  key: 'drag_drop',
  name: 'Arrastrar y soltar',
  group: 'questions',
  usage: 'Elementos que el estudiante arrastra a sus destinos correctos, con retroalimentación.',
  propsSchema: z
    .object({
      items: z.array(dragItemSchema).min(2).max(8).describe('Elementos arrastrables'),
      targets: z.array(dragTargetSchema).min(2).max(8).describe('Destinos'),
      feedbackCorrect: feedbackSchema.describe('Retroalimentación cuando acierta'),
      feedbackIncorrect: feedbackSchema.describe('Retroalimentación cuando se equivoca'),
      attempts: attemptsSchema,
      ...questionLookShape,
    })
    .refine((props) => new Set(props.items.map((item) => item.id)).size === props.items.length, {
      message: 'Los ids de los elementos deben ser únicos.',
      path: ['items'],
    })
    .refine((props) => new Set(props.targets.map((target) => target.id)).size === props.targets.length, {
      message: 'Los ids de los destinos deben ser únicos.',
      path: ['targets'],
    })
    .refine(
      (props) => {
        const itemIds = new Set(props.items.map((item) => item.id));
        return props.targets.every((target) => itemIds.has(target.correctItemId));
      },
      {
        message: 'Cada correctItemId debe referenciar un elemento existente.',
        path: ['targets'],
      },
    ),
  defaults: {
    items: [
      { id: 'i1', text: 'Elemento 1' },
      { id: 'i2', text: 'Elemento 2' },
    ],
    targets: [
      { id: 't1', text: 'Destino 1', correctItemId: 'i1' },
      { id: 't2', text: 'Destino 2', correctItemId: 'i2' },
    ],
    feedbackCorrect: '¡Correcto!',
    feedbackIncorrect: 'Revisa de nuevo la explicación.',
    attempts: 2,
    color: 'primary',
    confetti: true,
  },
  defaultSize: { w: 80, h: 35 },
  usesMedia: false,
  isQuestion: true,
});

export const orderingComponent = defineComponent({
  key: 'ordering',
  name: 'Ordenar',
  group: 'questions',
  usage: 'Lista de elementos que el estudiante debe ordenar correctamente. De 2 a 8 elementos.',
  propsSchema: z.object({
    items: z.array(z.string().trim().min(1).max(200)).min(2).max(8).describe('Elementos en el orden correcto'),
    feedbackCorrect: feedbackSchema.describe('Retroalimentación cuando acierta'),
    feedbackIncorrect: feedbackSchema.describe('Retroalimentación cuando se equivoca'),
    attempts: attemptsSchema,
    ...questionLookShape,
  }),
  defaults: {
    items: ['Primero', 'Segundo', 'Tercero'],
    feedbackCorrect: '¡Correcto!',
    feedbackIncorrect: 'Revisa de nuevo la explicación.',
    attempts: 2,
    color: 'primary',
    confetti: true,
  },
  defaultSize: { w: 80, h: 25 },
  fitsContent: true,
  usesMedia: false,
  isQuestion: true,
});

const matchPairSchema = z.object({
  left: z.string().trim().min(1).max(200).describe('Elemento de la izquierda'),
  right: z.string().trim().min(1).max(200).describe('Elemento de la derecha'),
});

export const matchingComponent = defineComponent({
  key: 'matching',
  name: 'Unir',
  group: 'questions',
  usage: 'Pares que el estudiante debe emparejar correctamente. De 2 a 6 pares.',
  propsSchema: z.object({
    pairs: z.array(matchPairSchema).min(2).max(6).describe('Pares a unir'),
    feedbackCorrect: feedbackSchema.describe('Retroalimentación cuando acierta'),
    feedbackIncorrect: feedbackSchema.describe('Retroalimentación cuando se equivoca'),
    attempts: attemptsSchema,
    ...questionLookShape,
  }),
  defaults: {
    pairs: [
      { left: 'Concepto A', right: 'Definición A' },
      { left: 'Concepto B', right: 'Definición B' },
    ],
    feedbackCorrect: '¡Correcto!',
    feedbackIncorrect: 'Revisa de nuevo la explicación.',
    attempts: 2,
    color: 'primary',
    confetti: true,
  },
  defaultSize: { w: 80, h: 30 },
  fitsContent: true,
  usesMedia: false,
  isQuestion: true,
});

export const quizTimerComponent = defineComponent({
  key: 'quiz_timer',
  name: 'Pregunta contrarreloj',
  group: 'questions',
  usage: 'Pregunta de opción múltiple con cuenta regresiva: al terminar el tiempo se bloquea y muestra la respuesta.',
  propsSchema: z
    .object({
      question: z.string().trim().min(1).max(300).describe('Pregunta'),
      options: z.array(optionSchema).min(2).max(6).describe('Opciones'),
      correctOptionId: z.string().trim().min(1).max(8).describe('Id de la opción correcta').meta({ ref: { list: 'options', value: 'id', label: 'text', letters: true } }),
      seconds: z.number().int().min(5).max(120).describe('Segundos para responder'),
      autoStart: z.boolean().describe('La cuenta empieza al aparecer; si no, con el botón Empezar'),
      feedbackCorrect: feedbackSchema.describe('Retroalimentación cuando acierta'),
      feedbackIncorrect: feedbackSchema.describe('Retroalimentación cuando se equivoca'),
      feedbackTimeout: feedbackSchema.describe('Mensaje cuando se acaba el tiempo'),
      ...questionLookShape,
    })
    .refine((props) => new Set(props.options.map((option) => option.id)).size === props.options.length, {
      message: 'Los ids de las opciones deben ser únicos.',
      path: ['options'],
    })
    .refine((props) => props.options.some((option) => option.id === props.correctOptionId), {
      message: 'correctOptionId debe ser el id de una de las opciones.',
      path: ['correctOptionId'],
    }),
  defaults: {
    question: '¿Cuál es el planeta más grande del sistema solar?',
    options: [
      { id: 'a', text: 'Saturno' },
      { id: 'b', text: 'Júpiter' },
      { id: 'c', text: 'Neptuno' },
      { id: 'd', text: 'Tierra' },
    ],
    correctOptionId: 'b',
    seconds: 20,
    autoStart: true,
    feedbackCorrect: '¡Correcto y a tiempo!',
    feedbackIncorrect: 'Esa no es. ¡La próxima vez!',
    feedbackTimeout: '¡Se acabó el tiempo!',
    color: 'orange',
    confetti: true,
  },
  defaultSize: { w: 80, h: 36 },
  fitsContent: true,
  usesMedia: false,
  isQuestion: true,
});
