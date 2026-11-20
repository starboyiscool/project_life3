<script lang="ts">
  import MacroBars from './MacroBars.svelte';
  import AddFood from './AddFood.svelte';
  import EntryEditor from './EntryEditor.svelte';
  import { db } from '../../lib/app-db';
  import { act, days, live, nutritionSettings } from '../../lib/state.svelte';
  import { go } from '../../lib/nav.svelte';
  import { addDays, diffDays, relativeDayLabel, type Day } from '../../lib/logic/day';
  import { goalForDay, periodSummary, sumMacros, type FoodEntry } from '../../lib/logic/nutrition';
  import { copyEntries, entriesBetween, entriesForDay, firstEntryDay, listGoals, saveMealAsDish } from '../../lib/repo/nutrition';

  let viewDay = $state<Day>(days.today);
  const day = $derived(viewDay > days.today ? days.today : viewDay);

  const data = live(
    () => {
      const d = day;
      const today = days.today;
      return async () => {
        const [entries, prev, goals, first] = await Promise.all([
          entriesForDay(db, d),
          entriesForDay(db, addDays(d, -1)),
          listGoals(db),
          firstEntryDay(db),
        ]);
        // observation average: recorded days before today, at most the last 7
        const obs = first ? periodSummary(await entriesBetween(db, addDays(today, -7), addDays(today, -1)), addDays(today, -7), addDays(today, -1)) : null;
        return { entries, prev, goals, first, obs };
      };
    },
    { entries: [] as FoodEntry[], prev: [] as FoodEntry[], goals: [], first: undefined, obs: null } as {
      entries: FoodEntry[];
      prev: FoodEntry[];
      goals: Awaited<ReturnType<typeof listGoals>>;
      first: Day | undefined;
      obs: ReturnType<typeof periodSummary> | null;
    },
  );

  const goal = $derived(goalForDay(data.current.goals, day));
  const total = $derived(sumMacros(data.current.entries.map((e) => e.total)));
  const meals = $derived([...new Set([...nutritionSettings.meals, ...data.current.entries.map((e) => e.meal)])]);
  const byMeal = $derived(
    new Map(meals.map((m) => [m, data.current.entries.filter((e) => e.meal === m)] as const)),
  );
  const prevByMeal = $derived(new Map(meals.map((m) => [m, data.current.prev.filter((e) => e.meal === m)] as const)));
  const prevTotal = $derived(sumMacros(data.current.prev.map((e) => e.total)).kcal);
  const obsDay = $derived(data.current.first ? diffDays(data.current.first, days.today) + 1 : 0);

  let addMeal = $state<string | null>(null);
  let editing = $state<FoodEntry | null>(null);

  async function copyDay() {
    if (data.current.entries.length && !confirm('В этом дне уже есть записи. Добавить к ним всё из предыдущего дня?')) return;
    const d = day;
    await act(() => copyEntries(db, addDays(d, -1), d), 'Скопировано');
  }

  function copyMeal(m: string) {
    const d = day;
    act(() => copyEntries(db, addDays(d, -1), d, m), 'Скопировано');
  }

  function customMeal() {
    const name = prompt('Название приёма пищи (например, «После зала»)')?.trim();
    if (name) addMeal = name;
  }

  async function saveTemplate(m: string, list: FoodEntry[]) {
    const name = prompt('Название блюда-шаблона', m)?.trim();
    if (!name) return;
    await act(() => saveMealAsDish(db, name, list), `Шаблон «${name}» сохранён`);
  }
</script>

<div class="stack">
  <div class="row spread daynav">
    <button class="icon-btn" aria-label="Предыдущий день" onclick={() => (viewDay = addDays(day, -1))}>‹</button>
    <b>{relativeDayLabel(day, days.today)}</b>
    <button class="icon-btn" aria-label="Следующий день" disabled={day >= days.today} onclick={() => (viewDay = addDays(day, 1))}>›</button>
  </div>

  <section class="card stack">
    <MacroBars {total} {goal} />
    {#if !goal && data.loaded}
      <div class="muted small stack obs">
        {#if data.current.first}
          <span>Наблюдение · день {obsDay}. Цели не заданы, просто записывай всё, что ешь.</span>
          {#if data.current.obs?.avg}
            <span class="num">
              Среднее за записанные дни ({data.current.obs.filledDays} из 7): {data.current.obs.avg.kcal} ккал · Б {Math.round(data.current.obs.avg.p)} ·
              Ж {Math.round(data.current.obs.avg.f)} · У {Math.round(data.current.obs.avg.c)}
            </span>
          {/if}
          {#if obsDay > 7}<button class="link small inline" onclick={() => go('food', 'calc')}>Неделя прошла: перейти к расчёту целей →</button>{/if}
        {:else}
          <span>Режим «Наблюдение»: первую неделю записывай всё, что ешь, без целей. Потом «Расчёт» предложит цели по твоему среднему.</span>
        {/if}
      </div>
    {/if}
  </section>

  {#each meals as m (m)}
    {@const list = byMeal.get(m) ?? []}
    {@const prev = prevByMeal.get(m) ?? []}
    <section class="card meal">
      <div class="row spread">
        <h2 class="section-title">{m}{#if list.length}<span class="num">&nbsp;· {sumMacros(list.map((e) => e.total)).kcal} ккал</span>{/if}</h2>
        <div class="row">
          {#if !list.length && prev.length}<button class="link small" onclick={() => copyMeal(m)}>Как вчера</button>{/if}
          <button class="icon-btn add" aria-label="Добавить в {m}" onclick={() => (addMeal = m)}>+</button>
        </div>
      </div>
      {#each list as e (e.id)}
        <button class="entry" onclick={() => (editing = e)}>
          <span class="grow name">{e.name}</span>
          {#if e.grams != null}<span class="muted small num">{Math.round(e.grams)} г</span>{/if}
          <span class="num kcal">{e.total.kcal}</span>
        </button>
      {/each}
      {#if list.filter((e) => e.grams).length >= 2}
        <button class="link small tpl" onclick={() => saveTemplate(m, list)}>Сохранить как блюдо-шаблон</button>
      {/if}
    </section>
  {/each}

  <div class="row wrap">
    {#if data.current.prev.length}
      <button onclick={copyDay}>Скопировать предыдущий день ({prevTotal} ккал)</button>
    {/if}
    <button class="link" onclick={customMeal}>+ Свой приём пищи</button>
  </div>
</div>

<AddFood {day} meal={addMeal} onclose={() => (addMeal = null)} />
<EntryEditor entry={editing} {meals} onclose={() => (editing = null)} />

<style>
  .daynav b {
    text-align: center;
  }

  .obs {
    gap: 4px;
  }

  .inline {
    padding: 0;
    min-height: 32px;
    text-align: left;
  }

  .meal {
    padding: 8px 16px;
  }

  .add {
    font-size: 1.4rem;
    min-height: 44px;
  }

  .entry {
    display: flex;
    width: 100%;
    gap: 10px;
    align-items: center;
    text-align: left;
    background: transparent;
    border: none;
    border-top: 1px solid var(--border);
    border-radius: 0;
    padding: 0 2px;
    min-height: 46px;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .kcal {
    min-width: 44px;
    text-align: right;
  }

  .tpl {
    padding: 0;
    min-height: 36px;
  }

  .wrap {
    flex-wrap: wrap;
  }
</style>
