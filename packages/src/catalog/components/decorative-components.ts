import { z } from 'zod';
import { defineComponent } from '../component-definition.ts';
import { colorProp, emojiProp, variantProp } from './shared.ts';

export const stickerComponent = defineComponent({
  key: 'sticker',
  name: 'Sticker',
  group: 'decorative',
  usage: 'Emoji sobre una forma de color, con movimiento suave. Decora y da tono a la diapositiva; no lleva contenido.',
  propsSchema: z.object({
    emoji: emojiProp('🚀', 'Emoji o texto muy corto del sticker'),
    shape: z.enum(['blob', 'circle', 'burst', 'none']).describe('Forma del fondo: blob (orgánica), circle (círculo), burst (estrella) o none (solo el emoji)'),
    color: colorProp('warning'),
    variant: variantProp('gradient'),
    animation: z.enum(['none', 'float', 'wiggle', 'pulse', 'spin']).describe('Movimiento: none, float (flotar), wiggle (balancear), pulse (latir) o spin (girar)'),
    rotation: z.number().min(-45).max(45).describe('Inclinación en grados'),
  }),
  defaults: { emoji: '🚀', shape: 'blob', color: 'warning', variant: 'gradient', animation: 'float', rotation: -6 },
  defaultSize: { w: 12, h: 12 },
  usesMedia: false,
  isQuestion: false,
});

export const badgeComponent = defineComponent({
  key: 'badge',
  name: 'Medalla',
  group: 'decorative',
  usage: 'Medalla o insignia de logro con emoji y etiqueta. Para celebrar avances o marcar retos por desbloquear.',
  propsSchema: z.object({
    emoji: emojiProp('🏆', 'Emoji de la medalla'),
    label: z.string().trim().max(40).describe('Nombre del logro'),
    caption: z.string().trim().max(60).describe('Texto secundario, por ejemplo cómo se gana'),
    shape: z.enum(['medal', 'shield', 'hexagon', 'star']).describe('Forma: medal (medalla), shield (escudo), hexagon (hexágono) o star (estrella)'),
    color: colorProp('warning'),
    earned: z.boolean().describe('true si el logro ya se obtuvo; false lo muestra bloqueado'),
    shine: z.boolean().describe('Brillo que recorre la medalla obtenida'),
  }),
  defaults: { emoji: '🏆', label: 'Explorador', caption: 'Completaste el reto', shape: 'medal', color: 'warning', earned: true, shine: true },
  defaultSize: { w: 16, h: 21 },
  usesMedia: false,
  isQuestion: false,
});

export const confettiComponent = defineComponent({
  key: 'confetti',
  name: 'Celebración',
  group: 'decorative',
  usage: 'Mensaje de celebración que lanza confeti al aparecer o cuando el estudiante hace clic. Para cerrar un reto o una clase.',
  propsSchema: z.object({
    emoji: emojiProp('🎉', 'Emoji central'),
    message: z.string().trim().max(80).describe('Mensaje de celebración'),
    caption: z.string().trim().max(120).describe('Texto secundario opcional'),
    trigger: z.enum(['auto', 'click', 'both']).describe('Cuándo se lanza el confeti: auto (al aparecer), click (al hacer clic) o both (ambos)'),
    intensity: z.enum(['low', 'medium', 'high']).describe('Cantidad de confeti'),
    color: colorProp('purple'),
    variant: variantProp('gradient'),
  }),
  defaults: { emoji: '🎉', message: '¡Lo lograste!', caption: 'Haz clic para celebrar otra vez', trigger: 'both', intensity: 'medium', color: 'purple', variant: 'gradient' },
  defaultSize: { w: 40, h: 18 },
  usesMedia: false,
  isQuestion: false,
});
