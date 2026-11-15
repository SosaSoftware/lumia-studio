import { z } from 'zod';
import { defineComponent } from '../component-definition.ts';
import { colorProp } from './shared.ts';

export const lumiOrbComponent = defineComponent({
  key: 'lumi_orb',
  name: 'Orbe de Lumi',
  group: 'lumi',
  usage: 'Orbe animado que representa a Lumi, el asistente de voz. Indica que Lumi escucha, piensa o narra la diapositiva.',
  propsSchema: z.object({
    variant: z.enum(['halo', 'equalizer', 'pulse', 'plasma', 'wave']).describe('Diseño del orbe: halo, equalizer (ecualizador), pulse (pulso), plasma o wave (ondas)'),
    state: z.enum(['idle', 'listening', 'thinking', 'speaking']).describe('Estado: idle (en reposo), listening (escucha), thinking (piensa) o speaking (habla)'),
    from: colorProp('primary', 'Primer color del orbe'),
    to: colorProp('accent', 'Segundo color del orbe'),
    showStatus: z.boolean().describe('Mostrar la etiqueta de estado bajo el orbe'),
    statusText: z.string().trim().max(40).describe('Texto de la etiqueta; vacío para usar el del estado'),
  }),
  defaults: { variant: 'halo', state: 'idle', from: 'primary', to: 'accent', showStatus: true, statusText: '' },
  defaultSize: { w: 18, h: 26 },
  usesMedia: false,
  isQuestion: false,
});

export const lumiBubbleComponent = defineComponent({
  key: 'lumi_bubble',
  name: 'Burbuja de Lumi',
  group: 'lumi',
  usage: 'Mensaje de Lumi en una burbuja de chat, con indicador de escritura antes de aparecer.',
  propsSchema: z.object({
    message: z.string().trim().min(1).max(300).describe('Mensaje de Lumi'),
    typing: z.boolean().describe('Mostrar los puntos de escritura antes del mensaje'),
    delayS: z.number().min(0).max(10).describe('Segundos de escritura antes del mensaje'),
    side: z.enum(['left', 'right']).describe('Lado del avatar de Lumi'),
    showAvatar: z.boolean().describe('Mostrar el mini orbe de Lumi junto a la burbuja'),
    color: colorProp('primary', 'Color del avatar y del borde'),
  }),
  defaults: {
    message: '¡Hola! Soy Lumi, tu compañero de aprendizaje. Hoy vamos a explorar el espacio juntos. 🚀',
    typing: true,
    delayS: 1.5,
    side: 'left',
    showAvatar: true,
    color: 'primary',
  },
  defaultSize: { w: 50, h: 14 },
  fitsContent: true,
  usesMedia: false,
  isQuestion: false,
});
