import { ref } from 'vue';

export type ThemeName = 'dark' | 'light';
export type Lang = 'es' | 'en';

export const THEME_KEY = 'lumia.studio.theme';
export const LANG_KEY = 'lumia.studio.lang';
/** Languages the interface can show today; English is listed but disabled until its translation exists. */
export const AVAILABLE_LANGS: readonly Lang[] = ['es'];

export function isLangAvailable(code: Lang): boolean {
  return AVAILABLE_LANGS.includes(code);
}

export function readTheme(storage: Storage = localStorage): ThemeName {
  try {
    return storage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    // Storage can be blocked by the browser; the default theme applies.
    return 'dark';
  }
}

export function readLang(storage: Storage = localStorage): Lang {
  try {
    const stored = storage.getItem(LANG_KEY);
    return AVAILABLE_LANGS.find((code) => code === stored) ?? 'es';
  } catch {
    // Storage can be blocked by the browser; the default language applies.
    return 'es';
  }
}

export const theme = ref<ThemeName>(readTheme());
export const lang = ref<Lang>(readLang());

/** Applies the theme to `<html>` (`data-theme="light"` or absent). */
export function applyTheme(next: ThemeName): void {
  theme.value = next;
  if (next === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
}

export function setTheme(next: ThemeName): void {
  applyTheme(next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // Not persisting the theme is harmless.
  }
}

export function toggleTheme(): void {
  setTheme(theme.value === 'dark' ? 'light' : 'dark');
}

/** The language selector only stores the choice; the translation arrives later. */
export function setLang(next: Lang): void {
  if (!isLangAvailable(next)) return;
  lang.value = next;
  try {
    localStorage.setItem(LANG_KEY, next);
  } catch {
    // Not persisting the language is harmless.
  }
}
