import { ICON_NAMES, THEME_COLOR_KEYS } from '@lumia/packages/catalog';
import { t, translateOr } from '../../i18n/index.ts';
import { iconLabel } from '../slide-components/content-icons.ts';
import { colorLabel } from '../slides/slide-style.ts';

/** Field name shown in Properties; the schema descriptions are written for Lumi, not for people. */
export function fieldLabel(key: string, fallback: string): string {
  return translateOr(`properties.fields.${key}`, fallback);
}

/** Label of an enum value; colors and icons use their own names. */
export function valueLabel(component: string, key: string, value: string): string {
  const scoped = translateOr(`properties.values.scoped.${component}.${key}.${value}`, '');
  if (scoped !== '') return scoped;
  const generic = translateOr(`properties.values.generic.${key}.${value}`, '');
  if (generic !== '') return generic;
  const color = THEME_COLOR_KEYS.find((candidate) => candidate === value);
  if (color !== undefined) return colorLabel(color);
  const icon = ICON_NAMES.find((candidate) => candidate === value);
  return icon === undefined ? value : iconLabel(icon);
}

/** Yes and no labels of a boolean prop. */
export function booleanLabels(component: string, key: string): [string, string] {
  const scope = component === 'true_false' && key === 'answer' ? 'trueFalse' : key === 'headerRow' || key === 'ordered' || key === 'showControls' ? key : 'default';
  return [t(`properties.booleans.${scope}.yes`), t(`properties.booleans.${scope}.no`)];
}
