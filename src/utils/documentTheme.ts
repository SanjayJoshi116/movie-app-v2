import type { Theme } from "../types";
import { darkThemeConfig, lightThemeConfig } from "../theme/antdTheme";

/** Same key and JSON encoding as UIContext's `useLocalStorage("cinedb_theme", "dark")`. */
export const THEME_STORAGE_KEY = "cinedb_theme";
const DEFAULT_THEME: Theme = "dark";

/** The saved theme, read before React renders. Anything unreadable is the default. */
export function readStoredTheme(): Theme {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    const value: unknown = raw === null ? DEFAULT_THEME : JSON.parse(raw);
    return value === "light" || value === "dark" ? value : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Puts the page and the browser's own UI in `theme`: the body class the CSS
 * keys on, `color-scheme` (native controls, popups, scrollbars) and the
 * mobile address bar's `theme-color`. Called once before React renders, so
 * the first paint is already in the saved theme, then on every change.
 */
export function applyDocumentTheme(theme: Theme): void {
  document.body.classList.toggle("dark-theme", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  const background = (theme === "dark" ? darkThemeConfig : lightThemeConfig).token?.colorBgLayout;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta && background) meta.content = background;
}
