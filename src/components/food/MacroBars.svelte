<script lang="ts">
  import { progress, type Macros } from '../../lib/logic/nutrition';

  let { total, goal }: { total: Macros; goal?: Macros | null } = $props();

  const rows = $derived([
    { key: 'kcal', label: 'Ккал', unit: 'ккал' },
    { key: 'p', label: 'Белки', unit: 'г' },
    { key: 'f', label: 'Жиры', unit: 'г' },
    { key: 'c', label: 'Углеводы', unit: 'г' },
  ] as const);
</script>

{#if goal}
  <div class="bars">
    {#each rows as r (r.key)}
      {@const pr = progress(total[r.key], goal[r.key], r.unit)}
      <div class="line">
        <div class="row spread small">
          <span>{r.label} <b class="num">{Math.round(total[r.key])}</b><span class="muted">&nbsp;/ {goal[r.key]}</span></span>
          <span class="muted">{pr.label}</span>
        </div>
        <div class="bar"><i style:--p={(pr.share * 100) / 100}></i></div>
      </div>
    {/each}
  </div>
{:else}
  <div class="row totals num">
    <span><b>{Math.round(total.kcal)}</b> <span class="muted small">ккал</span></span>
    <span class="muted small">Б {Math.round(total.p)} · Ж {Math.round(total.f)} · У {Math.round(total.c)}</span>
  </div>
{/if}

<style>
  .bars {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .line {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .totals {
    gap: 12px;
    flex-wrap: wrap;
  }
</style>
