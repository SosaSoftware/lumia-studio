import { ref } from 'vue';
import { en } from './locales/en/index.ts';
import { es } from './locales/es/index.ts';
import { LANGS } from './types.ts';
import type { Lang, MessageParams, MessageTree, MessageValue, PluralForms, PluralKey, TextKey } from './types.ts';

export { LANGS, LANG_NAMES } from './types.ts';
export type { Lang, MessageParams } from './types.ts';

/** Shape shared by every dictionary: Spanish is the reference, so a key missing in another language does not compile. */
export type Messages = typeof es;
export type MessageKey = TextKey<Messages>;
export type MessagePluralKey = PluralKey<Messages>;

export const LANG_KEY = 'lumia.studio.lang';
const DEFAULT_LANG: Lang = 'es';

const DICTIONARIES: Readonly<Record<Lang, Messages>> = { es, en };

function isPlural(value: PluralForms | MessageTree): value is PluralForms {
  return typeof value.one === 'string' && typeof value.other === 'string';
}

function flatten(tree: MessageTree, prefix: string, into: Map<string, MessageValue>): Map<string, MessageValue> {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    if (typeof value === 'string' || isPlural(value)) into.set(path, value);
    else flatten(value, path, into);
  }
  return into;
}

const FLAT: Readonly<Record<Lang, ReadonlyMap<string, MessageValue>>> = {
  es: flatten(DICTIONARIES.es, '', new Map()),
  en: flatten(DICTIONARIES.en, '', new Map()),
};

function isLang(value: unknown): value is Lang {
  return LANGS.some((code) => code === value);
}

/** Reads the stored language; Spanish applies when nothing valid is stored or the storage is blocked. */
export function readLang(storage: Storage = localStorage): Lang {
  try {
    const stored = storage.getItem(LANG_KEY);
    return isLang(stored) ? stored : DEFAULT_LANG;
  } catch {
    // Storage can be blocked by the browser; the default language applies.
    return DEFAULT_LANG;
  }
}

/** Language of the interface. Reading it inside a template or a computed makes it follow the language selector. */
export const lang = ref<Lang>(readLang());

/** Sets the `lang` attribute of `<html>` so assistive technology and the browser use the right language. */
export function applyLang(next: Lang): void {
  lang.value = next;
  document.documentElement.setAttribute('lang', next);
}

/** Switches the interface language at once and remembers it for the next session. */
export function setLang(next: Lang): void {
  applyLang(next);
  try {
    localStorage.setItem(LANG_KEY, next);
  } catch {
    // Not persisting the language is harmless.
  }
}

function fill(template: string, params: MessageParams | undefined): string {
  if (params === undefined) return template;
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = params[name];
    return value === undefined ? placeholder : String(value);
  });
}

function textOf(key: string): string | undefined {
  const value = FLAT[lang.value].get(key) ?? FLAT[DEFAULT_LANG].get(key);
  return typeof value === 'string' ? value : undefined;
}

/** Text of a message in the current language, with its `{name}` placeholders filled from `params`. */
export function t(key: MessageKey, params?: MessageParams): string {
  return fill(textOf(key) ?? key, params);
}

/** Singular or plural form of a message for `count`; `{count}` is always available as a placeholder. */
export function tn(key: MessagePluralKey, count: number, params?: MessageParams): string {
  const value = FLAT[lang.value].get(key) ?? FLAT[DEFAULT_LANG].get(key);
  if (value === undefined || typeof value === 'string') return key;
  const form = new Intl.PluralRules(lang.value).select(count) === 'one' ? value.one : value.other;
  return fill(form, { count, ...params });
}

/**
 * Text for a key built at run time (a component key from the catalog, for example). When the dictionaries have no
 * message for it, `fallback` is returned, so data the web does not know yet still shows something readable.
 */
export function translateOr(key: string, fallback: string, params?: MessageParams): string {
  const text = textOf(key);
  return text === undefined ? fallback : fill(text, params);
}

/** Formats a date and time for the current language. Invalid dates are returned unchanged. */
export function formatDateTime(value: string | number | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(lang.value, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Compares two strings with the collation of the current language. */
export function compareText(a: string, b: string): number {
  return a.localeCompare(b, lang.value);
}

/** Upper-cases text with the rules of the current language. */
export function upperCase(text: string): string {
  return text.toLocaleUpperCase(lang.value);
}
