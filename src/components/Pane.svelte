<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * Lazy keep-alive: the content mounts on the first activation and afterwards is only
   * hidden, so scroll-independent state (inputs, open details, live queries) survives
   * switching tabs and nothing is re-created or re-measured on return.
   */
  let { active, children }: { active: boolean; children: Snippet } = $props();

  let seen = $state(false);
  $effect.pre(() => {
    if (active) seen = true;
  });
</script>

{#if active || seen}
  <div class="pane" hidden={!active}>{@render children()}</div>
{/if}

<style>
  /* Same rhythm as .stack, so components with several root nodes keep their spacing. */
  .pane {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
</style>
