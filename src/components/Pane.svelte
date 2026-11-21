<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * Keep-alive pane: not mounted -> warm (mounted out of sight once the app is idle, so its data is
   * loaded before the first visit) -> active -> hidden (state, inputs and live queries survive).
   * A first visit therefore shows finished content: nothing grows or jumps after the switch.
   */
  let { active, children }: { active: boolean; children: Snippet } = $props();

  let seen = $state(false);
  let warm = $state(false);

  $effect.pre(() => {
    if (active) seen = true;
  });

  $effect(() => {
    if (warm || active) return;
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => (warm = true), { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(() => (warm = true), 600);
    return () => window.clearTimeout(id);
  });
</script>

{#if active || seen || warm}
  <div class="pane" class:warm={!active && !seen} hidden={seen && !active} inert={!active}>{@render children()}</div>
{/if}

<style>
  /* Same rhythm as .stack, so components with several root nodes keep their spacing. */
  .pane {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Warm: laid out at full width (charts measure correctly) but takes no space and is never painted. */
  .pane.warm {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 0;
    overflow: hidden;
    visibility: hidden;
    pointer-events: none;
  }
</style>
