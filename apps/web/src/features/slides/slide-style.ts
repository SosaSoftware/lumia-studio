import type { StyleValue } from 'vue';
import type { SlideTypeKey, ThemeColorKey } from '@lumia/packages/catalog';

/**
 * Background and text colors of a slide for a theme color key.
 * Covers on the default surface get the soft gradient of the design.
 */
export function slideStyle(background: ThemeColorKey, type?: SlideTypeKey): StyleValue {
  const paint = type === 'cover' && background === 'surface' ? 'var(--sl-cover-gradient)' : `var(--sl-${background})`;
  return {
    background: paint,
    '--sl-fg': `var(--sl-on-${background})`,
    '--sl-fg-2': `var(--sl-on-${background}-2)`,
    '--sl-kicker': `var(--sl-kicker-${background})`,
  };
}

/** Footer texts of a slide: the name of the class and the slide number. */
export interface SlideFooter {
  left: string;
  right: string;
}

/** Footer of a slide of a class, e.g. "Fracciones equivalentes" and "3". */
export function slideFooter(node: { displayName: string } | null, position: number): SlideFooter | null {
  if (node === null) return null;
  return { left: node.displayName, right: String(position) };
}

/** Slides other than the cover show the class and the slide number at the bottom, as in the design. */
export function hasFooter(type: SlideTypeKey): boolean {
  return type !== 'cover';
}

/** Spanish names of the theme color keys, for backgrounds and component colors. */
export const COLOR_LABELS: Readonly<Record<ThemeColorKey, string>> = {
  surface: 'Claro',
  'surface-alt': 'Blanco',
  primary: 'Azul',
  accent: 'Celeste',
  success: 'Verde',
  warning: 'Amarillo',
  danger: 'Rojo',
  text: 'Oscuro',
  muted: 'Gris',
};
