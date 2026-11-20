<script lang="ts">
  import { db } from '../../lib/app-db';
  import { days, live } from '../../lib/state.svelte';
  import { go } from '../../lib/nav.svelte';
  import { goalForDay, progress, sumMacros, type Macros, type NutritionGoal } from '../../lib/logic/nutrition';
  import { entriesForDay, listGoals } from '../../lib/repo/nutrition';

  const data = live(
    () => {
      const d = days.today;
      return async () => {
        const [entries, goals] = await Promise.all([entriesForDay(db, d), listGoals(db)]);
        return { total: sumMacros(entries.map((e) => e.total)), goal: goalForDay(goals, d) };
      };
    },
    { total: { kcal: 0, p: 0, f: 0, c: 0 } as Macros, goal: undefined as NutritionGoal | undefined },
  );

  const t = $derived(data.current.total);
  const g = $derived(data.current.goal);
  const kcal = $derived(g ? progress(t.kcal, g.kcal, 'ккал') : null);
  const left = (v: number, goal: number) => Math.round(goal - v);
</script>

<button class="sum" onclick={() => go('food', 'day')}>
  {#if g && kcal}
    <div class="row spread">
      <span class="num"><b>{t.kcal}</b><span class="muted">&nbsp;/ {g.kcal} ккал</span></span>
      <span class="muted small">{kcal.label}</span>
    </div>
    <div class="bar"><i style:width="{kcal.share * 100}%"></i></div>
    <span class="muted small num">
      осталось Б {left(t.p, g.p)} · Ж {left(t.f, g.f)} · У {left(t.c, g.c)} г
    </span>
  {:else}
    <div class="row spread">
      <span class="num"><b>{t.kcal}</b> <span class="muted">ккал</span></span>
      <span class="muted small num">Б {Math.round(t.p)} · Ж {Math.round(t.f)} · У {Math.round(t.c)}</span>
    </div>
    <span class="muted small">Наблюдение: записывай всё, что ешь</span>
  {/if}
</button>

<style>
  .sum {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: 0;
    height: auto;
  }
</style>
