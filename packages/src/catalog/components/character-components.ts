import { z } from 'zod';
import { defineComponent } from '../component-definition.ts';
import { colorProp, emojiProp } from './shared.ts';

export const characterGuideComponent = defineComponent({
  key: 'character_guide',
  name: 'Personaje guía',
  group: 'characters',
  usage: 'Personaje con nombre que habla al estudiante en una burbuja. Para narrar, presentar un tema o dar instrucciones.',
  propsSchema: z.object({
    avatar: emojiProp('👩‍🚀', 'Emoji del personaje', 'characters'),
    name: z.string().trim().max(40).describe('Nombre del personaje; vacío para ocultarlo'),
    message: z.string().trim().min(1).max(300).describe('Lo que dice el personaje'),
    expression: z.enum(['none', 'happy', 'thinking', 'excited', 'surprised', 'sad']).describe('Gesto que acompaña al personaje'),
    bubble: z.enum(['speech', 'thought']).describe('Burbuja de diálogo (speech) o de pensamiento (thought)'),
    side: z.enum(['left', 'right']).describe('Lado en el que está el personaje'),
    color: colorProp('primary', 'Color del círculo del personaje'),
    animated: z.boolean().describe('El personaje rebota suavemente y la burbuja aparece con animación'),
  }),
  defaults: {
    avatar: '👩‍🚀',
    name: 'Valentina',
    message: '¡Hola! Hoy seré tu guía en este viaje espacial. ¿Listo para despegar?',
    expression: 'happy',
    bubble: 'speech',
    side: 'left',
    color: 'primary',
    animated: true,
  },
  defaultSize: { w: 60, h: 18 },
  usesMedia: false,
  isQuestion: false,
});

const comicCharacterSchema = z.object({
  emoji: emojiProp('🧑', 'Emoji del personaje', 'characters'),
  line: z.string().trim().max(120).describe('Lo que dice; vacío para que no hable'),
  bubble: z.enum(['speech', 'thought', 'shout']).describe('Burbuja: speech (habla), thought (piensa) o shout (grita)'),
});

export const comicComponent = defineComponent({
  key: 'comic',
  name: 'Viñeta de cómic',
  group: 'characters',
  usage: 'Viñeta de cómic con un escenario, de 1 a 3 personajes y sus diálogos, y un recuadro de narración opcional.',
  propsSchema: z.object({
    scene: z.enum(['sky', 'space', 'ocean', 'forest', 'classroom', 'city', 'plain']).describe('Escenario de fondo'),
    caption: z.string().trim().max(100).describe('Recuadro de narración; vacío para ocultarlo'),
    characters: z.array(comicCharacterSchema).min(1).max(3).describe('Personajes de izquierda a derecha'),
    halftone: z.boolean().describe('Trama de puntos de cómic sobre el fondo'),
  }),
  defaults: {
    scene: 'space',
    caption: 'Mientras tanto, en la estación espacial…',
    characters: [
      { emoji: '👩‍🚀', line: '¡Mira! ¡Una estrella fugaz!', bubble: 'shout' },
      { emoji: '👨‍🚀', line: '¡Pide un deseo!', bubble: 'speech' },
    ],
    halftone: true,
  },
  defaultSize: { w: 56, h: 34 },
  usesMedia: false,
  isQuestion: false,
});

export const emotionAvatarComponent = defineComponent({
  key: 'emotion_avatar',
  name: 'Avatar de emociones',
  group: 'characters',
  usage: 'Cara que expresa una emoción. Con interactive, el estudiante elige cómo se siente: sirve como termómetro emocional.',
  propsSchema: z.object({
    emotion: z.enum(['happy', 'excited', 'calm', 'thinking', 'surprised', 'sad', 'angry']).describe('Emoción que se muestra'),
    label: z.string().trim().max(60).describe('Texto bajo la cara; vacío para mostrar el nombre de la emoción'),
    interactive: z.boolean().describe('El estudiante puede elegir la emoción'),
    prompt: z.string().trim().max(80).describe('Pregunta cuando es interactivo, por ejemplo ¿Cómo te sientes?'),
    color: colorProp('warning', 'Color del halo'),
    animated: z.boolean().describe('La cara se mueve según la emoción'),
  }),
  defaults: { emotion: 'happy', label: '', interactive: true, prompt: '¿Cómo te sientes hoy?', color: 'warning', animated: true },
  defaultSize: { w: 30, h: 30 },
  usesMedia: false,
  isQuestion: false,
});

export const sceneBackgroundComponent = defineComponent({
  key: 'scene_background',
  name: 'Fondo de escena',
  group: 'characters',
  usage: 'Fondo temático que ocupa la diapositiva, con elementos animados. Va detrás del resto de componentes.',
  propsSchema: z.object({
    theme: z.enum(['space', 'ocean', 'forest', 'city', 'desert', 'sunset', 'snow']).describe('Escenario'),
    elements: z.array(z.string().trim().min(1).max(14).meta({ emojiSet: 'general' })).max(6).describe('Emojis que flotan en la escena; vacío para usar los del escenario'),
    animated: z.boolean().describe('Los elementos se mueven'),
    dim: z.boolean().describe('Oscurecer el fondo para que el texto encima se lea mejor'),
  }),
  defaults: { theme: 'space', elements: [], animated: true, dim: false },
  defaultSize: { w: 100, h: 56.25 },
  usesMedia: false,
  isQuestion: false,
});
