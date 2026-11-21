<script lang="ts">
  import WeightInput from '../components/WeightInput.svelte';
  import WeightChart from '../components/WeightChart.svelte';
  import { db } from '../lib/app-db';
  import { act, days, live } from '../lib/state.svelte';
  import { deleteWeight, listWeights, saveWeight, type WeightEntry } from '../lib/repo/weights';
  import { addDays, relativeDayLabel } from '../lib/logic/day';
  import { formatKg, formatSigned, movingAverage, parseKg, weeklyTrend } from '../lib/logic/weight';

  type Range = 30 | 90 | 0;
  let range = $state<Range>(30);

  const all = live(() => () => listWeights(db), [] as WeightEntry[]);
  const shown = $derived(range ? all.current.filter((e) => e.day > addDays(days.today, -range)) : all.current);
  const trend = $derived(weeklyTrend(all.current));
  const lastAvg = $derived(movingAverage(all.current).at(-1));

  let pastDay = $state('');
  let pastText = $state('');

  async function savePast(ev: SubmitEvent) {
    ev.preventDefault();
    const kg = parseKg(pastText);
    if (!pastDay || kg == null || pastDay > days.today) return;
    const exists = all.current.find((w) => w.day === pastDay);
    if (exists && !confirm(`За этот день уже есть ${formatKg(exists.kg)} кг. Заменить?`)) return;
    const d = pastDay;
    if (await act(() => saveWeight(db, d, kg), 'Сохранено')) pastText = '';
  }

  function remove(e: WeightEntry) {
    if (confirm(`Удалить замер ${formatKg(e.kg)} кг за ${relativeDayLabel(e.day, days.today)}?`)) act(() => deleteWeight(db, e.day));
  }
</script>

<div class="stack">
  <section class="card stack">
    <h2 class="section-title">Сегодня</h2>
    <WeightInput />
    <p class="muted small">Взвешивайся в одних и тех же условиях, например сразу после тренировки, до еды. Тогда тренд честнее.</p>
  </section>

  <section class="card stack">
    <div class="row stats">
      <div>
        <b>{lastAvg ? formatKg(lastAvg.avg) : '—'}</b><span class="muted small">среднее за 7 дн., кг</span>
      </div>
      <div>
        <b>{trend !== null ? formatSigned(trend) : '—'}</b><span class="muted small">изменение тренда, кг/нед</span>
      </div>
    </div>
    {#if trend === null && all.current.length > 0}
      <p class="muted small">Тренд появится, когда будет больше недели замеров.</p>
    {/if}
  </section>

  {#if all.current.length}
    <section class="card stack">
      <div class="seg">
        <button class:on={range === 30} onclick={() => (range = 30)}>30 дней</button>
        <button class:on={range === 90} onclick={() => (range = 90)}>90 дней</button>
        <button class:on={range === 0} onclick={() => (range = 0)}>Всё</button>
      </div>
      <WeightChart entries={shown} />
    </section>

    <section class="card">
      <h2 class="section-title">Замеры</h2>
      {#each [...all.current].reverse().slice(0, 60) as e (e.day)}
        <div class="row spread item">
          <span>{relativeDayLabel(e.day, days.today)}</span>
          <span class="row"><b>{formatKg(e.kg)}</b><button class="link small" onclick={() => remove(e)}>Удалить</button></span>
        </div>
      {/each}
    </section>
  {/if}

  <details class="card">
    <summary>Замер за другой день</summary>
    <form class="row past" onsubmit={savePast}>
      <input type="date" bind:value={pastDay} max={days.today} aria-label="Дата" />
      <input bind:value={pastText} inputmode="decimal" placeholder="кг" aria-label="Вес, кг" />
      <button type="submit" class="primary" disabled={!pastDay || parseKg(pastText) == null}>OK</button>
    </form>
  </details>
</div>

<style>
  .stats {
    justify-content: space-around;
    text-align: center;
    align-items: flex-start;
  }

  .stats div {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .stats b {
    font-size: var(--fs-xl);
  }

  summary {
    min-height: 32px;
    cursor: pointer;
    color: var(--muted);
  }

  .past {
    margin-top: 12px;
  }

  .past input[type='date'] {
    flex: 1.4;
  }

  .past input:not([type='date']) {
    flex: 1;
  }

  .item {
    min-height: 48px;
    border-bottom: 1px solid var(--border);
  }
</style>
