import { ref } from 'vue';

export type ThemeName = 'dark' | 'light';

export const THEME_KEY = 'lumia.studio.theme';

export function readTheme(storage: Storage = localStorage): ThemeName {
  try {
    return storage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    // Storage can be blocked by the browser; the default theme applies.
    return 'dark';
  }
}

export const theme = ref<ThemeName>(readTheme());

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
