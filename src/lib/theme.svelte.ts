import { flushSync } from 'svelte';
import { act, saveSettings, settings, type Settings } from './state.svelte';
import { horizon, type Resolved } from './horizon';

type Pref = Settings['theme'];

/** Mirrors the preference for the blocking script in index.html (no white flash on a dark start). */
const STORAGE_KEY = 'lt-theme';
const THEME_COLOR: Record<Resolved, string> = { light: '#f6f4ef', dark: '#262624' };

export const theme = $state<{ resolved: Resolved; busy: boolean }>({
  resolved: typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  busy: false,
});

const prefersDark = () => matchMedia('(prefers-color-scheme: dark)').matches;
export const resolveTheme = (pref: Pref): Resolved => (pref === 'system' ? (prefersDark() ? 'dark' : 'light') : pref);

function paint(r: Resolved): void {
  document.documentElement.dataset.theme = r;
  theme.resolved = r;
}

function chrome(r: Resolved): void {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[r]);
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', r);
}

function remember(pref: Pref): void {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // storage unavailable: the app still works, only the first paint may use the default
  }
}

/** Keeps <html data-theme> in sync with the saved preference and the OS setting. Call once in App. */
export function useThemeSync(): void {
  $effect(() => {
    const pref = settings.theme;
    remember(pref);
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      if (theme.busy) return;
      const r = resolveTheme(pref);
      if (document.documentElement.dataset.theme !== r) paint(r);
      chrome(r);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  });
}

/** The single way to change the theme: header toggle and the settings select both call it. */
export async function setTheme(pref: Pref, okText?: string): Promise<void> {
  if (theme.busy) return;
  const to = resolveTheme(pref);
  const commit = () => {
    flushSync(() => {
      settings.theme = pref;
    });
    paint(to);
  };
  const animate =
    to !== theme.resolved &&
    typeof document.startViewTransition === 'function' &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (animate) {
    theme.busy = true;
    try {
      await horizon(to, commit, () => chrome(to));
    } catch {
      // skipped by the browser: fall through to a plain switch
    } finally {
      theme.busy = false;
    }
  }
  if (theme.resolved !== to || settings.theme !== pref) commit();
  chrome(to);
  remember(pref);
  await act(() => saveSettings({ theme: pref }), okText);
}
