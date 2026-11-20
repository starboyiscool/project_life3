<script lang="ts">
  import { addRest, rest, stopRest } from '../../lib/rest.svelte';
  import { formatDuration } from '../../lib/logic/gym';
</script>

{#if rest.until}
  <div class="rest card" role="timer" aria-live="off">
    <div class="row spread">
      <span>Отдых <b class="num t">{formatDuration(rest.left)}</b></span>
      <span class="row">
        <button class="chip" onclick={() => addRest(30)}>+30 с</button>
        <button class="chip" onclick={stopRest}>Хватит</button>
      </span>
    </div>
    <div class="bar"><i style="width: {rest.total ? (100 * rest.left) / rest.total : 0}%"></i></div>
  </div>
{/if}

<style>
  .rest {
    position: sticky;
    bottom: calc(76px + env(safe-area-inset-bottom));
    z-index: 4;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
    border-color: var(--accent);
  }

  .t {
    font-size: 1.3rem;
    margin-left: 4px;
  }
</style>
