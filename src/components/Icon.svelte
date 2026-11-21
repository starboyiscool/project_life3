<script lang="ts">
  /** One icon set for the whole app: 24 px grid, 1.6 stroke, round caps (replaces text glyphs). */
  type Name = 'back' | 'close' | 'star' | 'more' | 'check' | 'up' | 'down' | 'plus' | 'minus' | 'forward' | 'arrowRight';

  let { name, size = 20, filled = false, label }: { name: Name; size?: number; filled?: boolean; label?: string } = $props();

  const PATHS: Record<Exclude<Name, 'more'>, string> = {
    back: 'M15 5l-7 7 7 7',
    forward: 'M9 5l7 7-7 7',
    arrowRight: 'M5 12h14M13 6l6 6-6 6',
    close: 'M6 6l12 12M18 6 6 18',
    star: 'M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    up: 'M12 19V5M6 11l6-6 6 6',
    down: 'M12 5v14M6 13l6 6 6-6',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
  };
</script>

<svg
  class="icon"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill={filled ? 'currentColor' : 'none'}
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
>
  {#if name === 'more'}
    <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
  {:else}
    <path d={PATHS[name]} />
  {/if}
</svg>
