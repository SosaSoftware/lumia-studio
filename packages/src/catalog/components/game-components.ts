import { z } from 'zod';
import { defineComponent } from '../component-definition.ts';
import { colorProp, emojiProp, feedbackSchema } from './shared.ts';

const memoryPairSchema = z.object({
  front: z.string().trim().min(1).max(24).describe('Contenido de la primera tarjeta: emoji o texto corto'),
  match: z.string().trim().min(1).max(24).describe('Contenido de su pareja; igual al anterior para parejas idénticas'),
});

export const memoryComponent = defineComponent({
  key: 'memory',
  name: 'Memoria',
  group: 'games',
  usage: 'Juego de memoria con 2 a 8 parejas. Cada pareja puede ser idéntica (🪐 y 🪐) o un concepto y su respuesta (H₂O y Agua).',
  propsSchema: z.object({
    pairs: z.array(memoryPairSchema).min(2).max(8).describe('Parejas de tarjetas'),
    color: colorProp('purple', 'Color del dorso de las tarjetas'),
    backSymbol: z.string().trim().max(4).describe('Símbolo del dorso de las tarjetas'),
    showMoves: z.boolean().describe('Mostrar el contador de intentos'),
    feedbackCorrect: feedbackSchema.describe('Mensaje al encontrar todas las parejas'),
    confetti: z.boolean().describe('Lanzar confeti al terminar'),
  }),
  defaults: {
    pairs: [
      { front: '🪐', match: '🪐' },
      { front: '⭐', match: '⭐' },
      { front: '🌕', match: '🌕' },
      { front: '☄️', match: '☄️' },
    ],
    color: 'purple',
    backSymbol: '?',
    showMoves: true,
    feedbackCorrect: '¡Encontraste todas las parejas!',
    confetti: true,
  },
  defaultSize: { w: 50, h: 40 },
  usesMedia: false,
  isQuestion: true,
});

export const wordSearchComponent = defineComponent({
  key: 'word_search',
  name: 'Sopa de letras',
  group: 'games',
  usage: 'Sopa de letras con 3 a 10 palabras escondidas que el estudiante marca arrastrando sobre las letras.',
  propsSchema: z.object({
    title: z.string().trim().max(80).describe('Título o pista del juego; vacío para ocultarlo'),
    words: z
      .array(z.string().trim().min(2).max(12).regex(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+$/, 'Solo letras, sin espacios ni números'))
      .min(3)
      .max(10)
      .describe('Palabras escondidas, solo letras'),
    size: z.number().int().min(8).max(14).describe('Letras por lado de la cuadrícula'),
    diagonal: z.boolean().describe('Esconder palabras también en diagonal'),
    backwards: z.boolean().describe('Esconder palabras también al revés'),
    color: colorProp('primary', 'Color de las palabras encontradas'),
    feedbackCorrect: feedbackSchema.describe('Mensaje al encontrar todas las palabras'),
    confetti: z.boolean().describe('Lanzar confeti al terminar'),
  }),
  defaults: {
    title: 'Encuentra los planetas',
    words: ['TIERRA', 'MARTE', 'VENUS', 'SATURNO', 'URANO'],
    size: 10,
    diagonal: true,
    backwards: false,
    color: 'primary',
    feedbackCorrect: '¡Encontraste todas las palabras!',
    confetti: true,
  },
  defaultSize: { w: 64, h: 40 },
  usesMedia: false,
  isQuestion: true,
});

export const hangmanComponent = defineComponent({
  key: 'hangman',
  name: 'Ahorcado',
  group: 'games',
  usage: 'Adivinar una palabra o frase corta letra por letra antes de agotar los errores, con pista opcional.',
  propsSchema: z.object({
    word: z
      .string()
      .trim()
      .min(2)
      .max(24)
      .regex(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+$/, 'Solo letras y espacios')
      .describe('Palabra o frase a adivinar'),
    hint: z.string().trim().max(120).describe('Pista; vacío para no mostrarla'),
    maxMistakes: z.number().int().min(3).max(8).describe('Errores permitidos'),
    style: z.enum(['balloons', 'classic']).describe('Dibujo: balloons (globos que se revientan, apto para niños) o classic (ahorcado clásico)'),
    color: colorProp('primary'),
    feedbackCorrect: feedbackSchema.describe('Mensaje al adivinar'),
    feedbackIncorrect: feedbackSchema.describe('Mensaje al agotar los errores'),
    confetti: z.boolean().describe('Lanzar confeti al adivinar'),
  }),
  defaults: {
    word: 'Fotosíntesis',
    hint: 'Proceso con el que las plantas fabrican su alimento',
    maxMistakes: 6,
    style: 'balloons',
    color: 'primary',
    feedbackCorrect: '¡Adivinaste!',
    feedbackIncorrect: 'Se acabaron los intentos.',
    confetti: true,
  },
  defaultSize: { w: 70, h: 40 },
  usesMedia: false,
  isQuestion: true,
});

const raceQuestionSchema = z.object({
  question: z.string().trim().min(1).max(160).describe('Pregunta'),
  correct: z.string().trim().min(1).max(60).describe('Respuesta correcta'),
  wrong: z.array(z.string().trim().min(1).max(60)).min(1).max(3).describe('Respuestas incorrectas'),
});

export const racingComponent = defineComponent({
  key: 'racing',
  name: 'Carrera de preguntas',
  group: 'games',
  usage: 'Carrera contra un rival: cada respuesta correcta adelanta al estudiante; el rival avanza solo con el tiempo. De 2 a 8 preguntas.',
  propsSchema: z.object({
    questions: z.array(raceQuestionSchema).min(2).max(8).describe('Preguntas de la carrera; una por tramo'),
    player: emojiProp('🚀', 'Emoji del estudiante'),
    rival: emojiProp('🛸', 'Emoji del rival'),
    rivalSpeed: z.enum(['slow', 'normal', 'fast']).describe('Velocidad del rival'),
    color: colorProp('primary', 'Color del carril del estudiante'),
    feedbackCorrect: feedbackSchema.describe('Mensaje al ganar'),
    feedbackIncorrect: feedbackSchema.describe('Mensaje al perder'),
    confetti: z.boolean().describe('Lanzar confeti al ganar'),
  }),
  defaults: {
    questions: [
      { question: '¿Cuál es el planeta más cercano al Sol?', correct: 'Mercurio', wrong: ['Venus', 'Marte'] },
      { question: '¿Cuántos planetas tiene el sistema solar?', correct: '8', wrong: ['9', '7'] },
      { question: '¿Qué planeta tiene anillos más visibles?', correct: 'Saturno', wrong: ['Júpiter', 'Urano'] },
    ],
    player: '🚀',
    rival: '🛸',
    rivalSpeed: 'normal',
    color: 'primary',
    feedbackCorrect: '¡Ganaste la carrera!',
    feedbackIncorrect: 'El rival llegó primero. ¡Inténtalo otra vez!',
    confetti: true,
  },
  defaultSize: { w: 80, h: 42 },
  usesMedia: false,
  isQuestion: true,
});
