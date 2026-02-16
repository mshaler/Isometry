/**
 * Theme utilities — CSS-first, zero React state
 * Theme persists in localStorage, CSS handles all visual changes
 */

const THEME_KEY = 'iso-theme';

export type Theme = 'dark' | 'light';

export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return (localStorage.getItem(THEME_KEY) as Theme) || 'dark';
}

export function setTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}

export function toggleTheme(): Theme {
  const current = getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

/** Initialize theme from localStorage on app load — call once in main.tsx */
export function initTheme(): void {
  const theme = getTheme();
  document.documentElement.setAttribute('data-theme', theme);
}
