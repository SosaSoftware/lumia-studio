import { z } from 'zod';
import type { ThemeColorKey } from '../theme-tokens.ts';
import { themeColorSchema } from '../theme-tokens.ts';

/** Color prop of a component, with the color it starts with. */
export function colorProp(fallback: ThemeColorKey, description = 'Color principal del componente'): z.ZodDefault<typeof themeColorSchema> {
  return themeColorSchema.default(fallback).describe(description);
}

/** How a component paints its main surface: gradient, solid color or soft tint. */
export function variantProp(fallback: 'gradient' | 'solid' | 'soft' = 'gradient'): z.ZodDefault<z.ZodEnum<{ gradient: 'gradient'; solid: 'solid'; soft: 'soft' }>> {
  return z.enum(['gradient', 'solid', 'soft']).default(fallback).describe('Estilo de color: gradient (degradado), solid (sólido) o soft (suave)');
}

/** Boolean prop that existing elements may lack, with the value they take then. */
export function flag(fallback: boolean, description: string): z.ZodDefault<z.ZodBoolean> {
  return z.boolean().default(fallback).describe(description);
}

/** Emojis the Properties panel offers for a prop: any emoji, or only people, animals and fantasy characters. */
export type EmojiSet = 'general' | 'characters';

/** Emoji or very short text shown as a glyph; empty for none. `set` tells the editor which picker to open. */
export function emojiProp(fallback: string, description = 'Emoji que acompaña al contenido; vacío para no mostrarlo', set: EmojiSet = 'general'): z.ZodDefault<z.ZodString> {
  return z.string().trim().max(14).default(fallback).describe(description).meta({ emojiSet: set });
}

export const alignSchema = z.enum(['left', 'center', 'right']).describe('Alineación del texto');

export const sizeSchema = z.enum(['sm', 'md', 'lg']).describe('Tamaño');

export const feedbackSchema = z.string().trim().min(1).max(300);

export const attemptsSchema = z.number().int().min(1).max(3).describe('Intentos permitidos');

/** Props every question shares for its look and its celebration. */
export const questionLookShape = {
  color: colorProp('primary', 'Color de la pregunta'),
  confetti: flag(true, 'Lanzar confeti cuando el estudiante acierta'),
};
