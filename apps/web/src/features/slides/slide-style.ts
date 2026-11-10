import type { StyleValue } from 'vue';
import type { ThemeColorKey } from '@lumia/packages/catalog';
import { t } from '../../i18n/index.ts';

/** Background and text colors of a slide for a theme color key. */
export function slideStyle(background: ThemeColorKey): StyleValue {
  return {
    background: `var(--sl-${background})`,
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

/** Name of a theme color key in the current language, for backgrounds and component colors. */
export function colorLabel(key: ThemeColorKey): string {
  return t(`colors.${key}`);
}
