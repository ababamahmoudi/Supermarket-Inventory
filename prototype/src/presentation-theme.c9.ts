import type { Theme } from "./auth-preferences.e1";

export const PRESENTATION_THEME_KEY = "supermarket-prototype-theme-hint-v1";

/** Optional tab-local display state, never a session or an authority input. */
export function rememberDisplayedTheme(
  userId: string,
  theme: Theme,
  storage?: Storage,
): boolean {
  try {
    const target = storage ?? sessionStorage;
    const value = JSON.stringify({ version: 1, user_id: userId, theme });
    if (target.getItem(PRESENTATION_THEME_KEY) !== value)
      target.setItem(PRESENTATION_THEME_KEY, value);
    return target.getItem(PRESENTATION_THEME_KEY) === value;
  } catch {
    // A display hint never replaces identity, preferences or unreadable data.
    return false;
  }
}
