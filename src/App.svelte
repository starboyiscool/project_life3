<script lang="ts">
  import ThemeToggle from './components/ThemeToggle.svelte';
  import Icon from './components/Icon.svelte';
  import { fly } from 'svelte/transition';
  import { useThemeSync } from './lib/theme.svelte';
  import TodayScreen from './screens/TodayScreen.svelte';
  import PlanScreen from './screens/PlanScreen.svelte';
  import NutritionScreen from './screens/NutritionScreen.svelte';
  import GymScreen from './screens/GymScreen.svelte';
  import MoreScreen from './screens/MoreScreen.svelte';
  import Pane from './components/Pane.svelte';
  import { toasts, dismiss, runAction } from './lib/toast.svelte';
  import { pwa, applyUpdate } from './lib/pwa.svelte';
  import { nav, go, type Tab } from './lib/nav.svelte';

  // <html data-theme> follows the saved preference and the OS; switching goes through setTheme().
  useThemeSync();

  const motion = (ms: number) => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms);

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

  <div class="brand" aria-label="Life Tracker"><svg class="brand-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg><span>LIFE TRACKER</span><ThemeToggle /></div>

  <!-- Screens mount once on first visit and are only hidden afterwards (Pane = lazy keep-alive). -->
  <main>
    <Pane active={nav.tab === 'today'}><TodayScreen /></Pane>
    <Pane active={nav.tab === 'plan'}><PlanScreen /></Pane>
    <Pane active={nav.tab === 'food'}><NutritionScreen /></Pane>
    <Pane active={nav.tab === 'gym'}><GymScreen /></Pane>
    <Pane active={nav.tab === 'more'}><MoreScreen /></Pane>
  </main>

  <nav>
    <div class="tabs" style:--i={tabs.findIndex((t) => t.id === nav.tab)}>
    <span class="plate" aria-hidden="true"></span>
    {#each tabs as t (t.id)}
      <button class:active={nav.tab === t.id} onclick={() => go(t.id)} aria-current={nav.tab === t.id}>
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d={t.icon} /></svg>
        <span>{t.label}</span>
      </button>
    {/each}
    </div>
  </nav>

  <div class="toasts" aria-live="polite">
    {#each toasts as t (t.id)}
      <div class="toast {t.kind}" in:fly={{ y: 12, duration: motion(200) }} out:fly={{ y: 12, duration: motion(200) }}>
        <span>{t.text}</span>
        {#if t.action}<button class="link" onclick={() => runAction(t.id)}>{t.actionLabel}</button>{:else}<button class="link" aria-label="Закрыть уведомление" onclick={() => dismiss(t.id)}><Icon name="close" size={18} /></button>{/if}
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
    font-size: var(--fs-xs);
    font-weight: 700;
    letter-spacing: 0.1em;
  }

  .brand-mark { color: var(--accent); width: 19px; height: 19px; flex: none; }

  nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    gap: 2px;
    padding: 8px 8px calc(8px + env(safe-area-inset-bottom));
    background: color-mix(in srgb, var(--surface) 84%, transparent);
    backdrop-filter: blur(14px);
    border-top: 1px solid var(--border);
    justify-content: center;
    z-index: 10;
  }

  .tabs {
    position: relative;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 2px;
    width: min(100%, 568px);
  }

  /* Sliding plate under the active tab: transform only. */
  .plate {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: calc((100% - 8px) / 5);
    border-radius: var(--radius);
    background: var(--surface-2);
    transform: translateX(calc(var(--i) * (100% + 2px)));
    transition: transform var(--dur-3) var(--ease-out);
  }

  nav button {
    position: relative;
    min-width: 0;
    min-height: 58px;
    padding: 5px 1px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    font-size: var(--fs-sm);
    font-weight: 500;
    background: transparent;
    border-color: transparent;
    color: var(--muted);
  }

  nav button svg { width: 21px; height: 21px; flex: none; }

  nav button.active {
    color: var(--accent);
    font-weight: 700;
  }

  /* The plate is the only highlight; hover changes the colour only. */
  nav button:not(:disabled):hover {
    background-color: transparent;
    border-color: transparent;
  }

  nav button:not(.active):not(:disabled):hover {
    color: var(--text);
  }

  @media (max-width: 360px) {
    main { padding-left: 16px; padding-right: 16px; }
    nav button { font-size: var(--fs-xs); }
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
    box-shadow: var(--shadow-2);
    background: var(--surface);
  }

  .toast.error {
    border-color: var(--danger);
  }
</style>
