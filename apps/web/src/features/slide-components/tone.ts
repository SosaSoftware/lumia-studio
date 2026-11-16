import { THEME_COLOR_KEYS } from '@lumia/packages/catalog';
import type { ThemeColorKey } from '@lumia/packages/catalog';

/** How a component paints its main surface with its color. */
export type Variant = 'gradient' | 'solid' | 'soft';

/** Vivid theme keys, in the order components cycle through them when each item gets its own color. */
export const VIVID_COLORS: readonly ThemeColorKey[] = ['primary', 'purple', 'pink', 'orange', 'warning', 'success', 'accent', 'danger'];

/** Theme key of a prop value, or the fallback when the value is not a key. */
export function colorKey(value: unknown, fallback: ThemeColorKey = 'primary'): ThemeColorKey {
  return THEME_COLOR_KEYS.find((key) => key === value) ?? fallback;
}

/** Vivid color of the item at `index`, for lists that paint every item differently. */
export function vividColor(index: number): ThemeColorKey {
  return VIVID_COLORS[index % VIVID_COLORS.length] ?? 'primary';
}

/**
 * CSS variables of a theme color: `--c` solid, `--c-soft` tint, `--c-ink` text on the tint, `--c-on` text on the
 * solid and `--c-grad` gradient. Components bind them on their root and style themselves with these names only.
 */
export function toneVars(value: unknown, fallback: ThemeColorKey = 'primary'): Record<string, string> {
  const key = colorKey(value, fallback);
  return {
    '--c': `var(--sl-${key})`,
    '--c-soft': `var(--sl-${key}-soft)`,
    '--c-ink': `var(--sl-${key}-ink)`,
    '--c-on': `var(--sl-on-${key})`,
    '--c-grad': `var(--sl-${key}-grad)`,
  };
}

/** Variant of a prop value; `gradient` when the value is not a variant. */
export function variantOf(value: unknown, fallback: Variant = 'gradient'): Variant {
  return value === 'gradient' || value === 'solid' || value === 'soft' ? value : fallback;
}

/**
 * Tone variables plus the surface of a variant: `--fill` background, `--fill-fg` text on it and `--fill-edge` border.
 */
export function fillVars(color: unknown, variant: unknown, fallback: ThemeColorKey = 'primary'): Record<string, string> {
  const look = variantOf(variant);
  const tone = toneVars(color, fallback);
  if (look === 'soft') return { ...tone, '--fill': 'var(--c-soft)', '--fill-fg': 'var(--c-ink)', '--fill-edge': 'color-mix(in srgb, var(--c) 35%, transparent)' };
  return { ...tone, '--fill': look === 'gradient' ? 'var(--c-grad)' : 'var(--c)', '--fill-fg': 'var(--c-on)', '--fill-edge': 'transparent' };
}
