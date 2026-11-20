<script lang="ts">
  import { flushSync } from 'svelte';
  import { act, saveSettings, settings } from './lib/state.svelte';
  import TodayScreen from './screens/TodayScreen.svelte';
  import PlanScreen from './screens/PlanScreen.svelte';
  import NutritionScreen from './screens/NutritionScreen.svelte';
  import GymScreen from './screens/GymScreen.svelte';
  import MoreScreen from './screens/MoreScreen.svelte';
  import { toasts, dismiss, runAction } from './lib/toast.svelte';
  import { pwa, applyUpdate } from './lib/pwa.svelte';
  import { nav, go, type Tab } from './lib/nav.svelte';

  let isDark = $state(false);
  $effect(() => {
    const preference = settings.theme;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
      isDark = resolved === 'dark';
      document.documentElement.dataset.theme = resolved;
    };
    apply(); media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  });

  // A broad, irregular front travels from the button side across the screen.
  function waveFrames(x: number, y: number, width: number, height: number): Keyframe[] {
    const cornerX = x < width / 2 ? width : 0, cornerY = y < height / 2 ? height : 0;
    const distance = Math.hypot(cornerX - x, cornerY - y) || 1;
    const dx = (cornerX - x) / distance, dy = (cornerY - y) / distance;
    const nx = -dy, ny = dx;
    const corners = [[0, 0], [width, 0], [0, height], [width, height]];
    const projected = corners.map(([cx, cy]) => (cx - x) * dx + (cy - y) * dy);
    const perpendicular = corners.map(([cx, cy]) => (cx - x) * nx + (cy - y) * ny);
    const margin = Math.max(width, height) * 0.13 + 80;
    const lo = Math.min(...perpendicular) - margin, hi = Math.max(...perpendicular) + margin;
    const from = Math.min(...projected) - margin, to = Math.max(...projected) + margin;
    const point = (s: number, n: number) => `${(x + dx * s + nx * n).toFixed(1)}px ${(y + dy * s + ny * n).toFixed(1)}px`;
    return Array.from({ length: 61 }, (_, frame) => {
      const t = frame / 60;
      const baseline = from + (to - from) * t;
      const amplitude = Math.min(width, height) * .11 * Math.sin(Math.PI * t);
      const front = Array.from({ length: 33 }, (_, i) => {
        const n = lo + (hi - lo) * i / 32;
        const wave = Math.sin(i / 32 * Math.PI * 3 + t * 2.5) * .68 + Math.sin(i / 32 * Math.PI * 6 - t * 2) * .32;
        return point(baseline + amplitude * wave, n);
      });
      return { offset: t, clipPath: `polygon(${[point(from - margin, lo), ...front, point(from - margin, hi)].join(', ')})` };
    });
  }

  let transitioning = false;
  async function toggleTheme(event: MouseEvent) {
    if (transitioning) return;
    const next = isDark ? 'light' : 'dark';
    const target = event.currentTarget as HTMLElement;
    const box = target.getBoundingClientRect();
    const x = box.left + box.width / 2, y = box.top + box.height / 2;
    const update = () => { flushSync(() => { settings.theme = next; }); };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof document.startViewTransition !== 'function') {
      update();
      await act(() => saveSettings({ theme: next }));
      return;
    }
    transitioning = true;
    try {
      const transition = document.startViewTransition(update);
      await transition.ready;
      document.documentElement.animate(
        waveFrames(x, y, innerWidth, innerHeight),
        { duration: 5000, easing: 'linear', pseudoElement: '::view-transition-new(root)' },
      );
      await act(() => saveSettings({ theme: next }));
      await transition.finished;
    } catch (err) {
      // A failed/skipped transition must not prevent the theme or preference being saved.
      if (settings.theme !== next) update();
      await act(() => saveSettings({ theme: next }));
    } finally { transitioning = false; }
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'today', label: 'Сегодня', icon: 'M3 10.5 12 3l9 7.5V20H4v-9.5 M9 20v-6h6v6' },
    { id: 'food', label: 'Питание', icon: 'M4 3v6a3 3 0 0 0 6 0V3 M7 3v18 M17 3c-2 2-3 5-3 8h5V3h-2z M19 11v10' },
    { id: 'plan', label: 'Календарь', icon: 'M5 4h14v16H5z M8 8h8 M8 12h8 M8 16h5' },
    { id: 'gym', label: 'Зал', icon: 'M4 9v6 M7 7v10 M7 12h10 M17 7v10 M20 9v6' },
    { id: 'more', label: 'Ещё', icon: 'M5 12h.01 M12 12h.01 M19 12h.01' },
  ];
</script>

<div class="shell">
  {#if pwa.needRefresh}
    <div class="banner">
      <span>Доступна новая версия</span>
      <button class="primary" onclick={applyUpdate}>Обновить</button>
    </div>
  {/if}

  <div class="brand" aria-label="Life Tracker"><svg class="brand-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg><span>LIFE TRACKER</span><button class="theme-toggle" aria-label={isDark ? 'Текущая тема: тёмная. Включить светлую' : 'Текущая тема: светлая. Включить тёмную'} onclick={toggleTheme}>{isDark ? '☾ Тёмная' : '☀ Светлая'}</button></div>

  <main>
    {#if nav.tab === 'today'}
      <TodayScreen />
    {:else if nav.tab === 'plan'}
      <PlanScreen />
    {:else if nav.tab === 'food'}
      <NutritionScreen />
    {:else if nav.tab === 'gym'}
      <GymScreen />
    {:else}
      <MoreScreen />
    {/if}
  </main>

  <nav>
    {#each tabs as t (t.id)}
      <button class:active={nav.tab === t.id} onclick={() => go(t.id)} aria-current={nav.tab === t.id}>
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d={t.icon} /></svg>
        <span>{t.label}</span>
      </button>
    {/each}
  </nav>

  <div class="toasts" aria-live="polite">
    {#each toasts as t (t.id)}
      <div class="toast {t.kind}">
        <span>{t.text}</span>
        {#if t.action}<button class="link" onclick={() => runAction(t.id)}>{t.actionLabel}</button>{:else}<button class="link" aria-label="Закрыть уведомление" onclick={() => dismiss(t.id)}>✕</button>{/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .shell {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    max-width: 640px;
    margin: 0 auto;
  }

  main {
    flex: 1;
    width: 100%;
    padding: 8px 20px calc(104px + env(safe-area-inset-bottom));
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 24px 20px 16px;
    color: var(--muted);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.1em;
  }

  .brand-mark { color: var(--accent); width: 19px; height: 19px; flex: none; }
  .theme-toggle { margin-left: auto; min-height: 44px; padding: 0 10px; font-size: .8rem; font-weight: 600; letter-spacing: normal; white-space: nowrap; color: var(--text); }

  nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    gap: 2px;
    padding: 8px 8px calc(8px + env(safe-area-inset-bottom));
    background: var(--surface);
    border-top: 1px solid var(--border);
    justify-content: center;
    z-index: 10;
  }

  nav button {
    flex: 1;
    min-width: 0;
    max-width: 112px;
    min-height: 58px;
    padding: 5px 1px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    font-size: 0.8rem;
    font-weight: 500;
    background: transparent;
    border-color: transparent;
    color: var(--muted);
  }

  nav button svg { width: 21px; height: 21px; flex: none; }

  nav button.active {
    color: var(--accent);
    background: var(--surface-2);
    font-weight: 700;
  }

  @media (max-width: 360px) {
    main { padding-left: 16px; padding-right: 16px; }
    nav button { font-size: 0.72rem; }
  }

  .banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 16px;
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
  }

  .toasts {
    position: fixed;
    left: 16px;
    right: 16px;
    bottom: calc(92px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    pointer-events: none;
    z-index: 20;
  }

  .toast {
    pointer-events: auto;
    width: 100%;
    max-width: 560px;
    height: auto;
    padding: 12px 16px;
    text-align: left;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 4px 12px rgb(0 0 0 / 0.08);
    background: var(--surface);
  }

  .toast.error {
    border-color: var(--danger);
  }
</style>
