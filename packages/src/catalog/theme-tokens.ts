import { z } from 'zod';

/** Colors are theme keys, never hex values, so slides follow the light and dark themes. */
export const THEME_COLOR_KEYS = ['surface', 'surface-alt', 'primary', 'accent', 'success', 'warning', 'danger', 'text', 'muted'] as const;

export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number];

export const themeColorSchema = z.enum(THEME_COLOR_KEYS).describe('Llave de color del tema');
