import { translateOr } from '../../i18n/index.ts';

/**
 * Names and usage notes of the components in the current language.
 * The shared catalog is written in Spanish for the API and Lumi, so the web translates by key and keeps the catalog
 * text for keys its dictionaries do not know (a component added by the API, for example).
 */
export function componentName(info: { readonly key: string; readonly name: string }): string {
  return translateOr(`catalog.components.${info.key}.name`, info.name);
}

export function componentUsage(info: { readonly key: string; readonly usage: string }): string {
  return translateOr(`catalog.components.${info.key}.usage`, info.usage);
}
