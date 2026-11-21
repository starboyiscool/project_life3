<script lang="ts">
  import { setTheme, theme } from '../lib/theme.svelte';

  const dark = $derived(theme.resolved === 'dark');
</script>

<button
  class="theme-toggle"
  aria-label={dark ? 'Текущая тема: тёмная. Включить светлую' : 'Текущая тема: светлая. Включить тёмную'}
  onclick={() => setTheme(dark ? 'light' : 'dark')}
>
  <svg class="ti" viewBox="0 0 24 24" aria-hidden="true">
    <mask id="theme-toggle-bite"><rect x="-6" y="-6" width="36" height="36" fill="white" /><circle class="bite" fill="black" /></mask>
    <circle class="core" cx="12" cy="12" fill="currentColor" mask="url(#theme-toggle-bite)" />
    <g class="rays" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </g>
  </svg>
  <span class="label">{dark ? 'Тёмная' : 'Светлая'}</span>
</button>

<style>
  /* Own transition layer: the 450 ms icon morph stays visible while the horizon crosses the screen. */
  .theme-toggle {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 10px;
    font-size: var(--fs-sm);
    font-weight: 600;
    letter-spacing: normal;
    white-space: nowrap;
    color: var(--text);
    background: transparent;
    border-color: transparent;
    view-transition-name: theme-toggle;
  }

  /* Fixed label width: switching the word does not move the icon. */
  .label {
    min-width: 4.8em;
    text-align: left;
  }

  .ti {
    width: 20px;
    height: 20px;
    flex: none;
    overflow: visible;
  }

  .core { r: 4.6px; transition: r 450ms var(--ease-out); }
  .bite { cx: 26px; cy: -2px; r: 6px; transition: cx 450ms var(--ease-out), cy 450ms var(--ease-out); }
  .rays { transform-origin: 12px 12px; transition: transform 450ms var(--ease-out), opacity 300ms var(--ease-out); }

  :global([data-theme='dark']) .core { r: 8px; }
  :global([data-theme='dark']) .bite { cx: 16.5px; cy: 7.5px; }
  :global([data-theme='dark']) .rays { transform: rotate(-45deg) scale(0.4); opacity: 0; }
</style>
