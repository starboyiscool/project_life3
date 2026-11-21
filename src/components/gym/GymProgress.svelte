<script lang="ts">
  import LineChart from './LineChart.svelte';
  import { days } from '../../lib/state.svelte';
  import { useGym } from '../../lib/gym-data.svelte';
  import { addDays, formatDayShort, weekStart } from '../../lib/logic/day';
  import {
    before,
    exerciseSeries,
    fmtKg,
    groupLabel,
    historyOf,
    markRecords,
    recordsOf,
    volume,
  } from '../../lib/logic/gym';

  const gym = useGym();

  const from = $derived(weekStart(days.today));
  const week = $derived(gym.data.done.filter((w) => w.day >= from && w.day <= days.today));
  const lastWeekCount = $derived(gym.data.done.filter((w) => w.day >= addDays(from, -7) && w.day < from).length);
  const weekRecords = $derived(week.reduce((a, w) => a + markRecords(w, before(gym.data.done, w), gym.exMap, gym.body).size, 0));
  const vol = $derived(volume(week, gym.exMap, gym.body));
  const groups = $derived([...vol.byGroup.entries()].sort((a, b) => b[1].sets - a[1].sets));

  const used = $derived(gym.data.exercises.filter((e) => gym.data.done.some((w) => w.items.some((i) => i.exerciseId === e.id && i.sets.length))));
  let selId = $state<string>();
  const sel = $derived(gym.exMap.get(Number(selId)) ?? used[0]);
  const series = $derived(sel ? exerciseSeries(gym.data.done, sel, gym.body) : []);
  const recs = $derived(sel ? recordsOf(historyOf(gym.data.done, sel.id!), sel.load, gym.body) : null);
  const bestReps = $derived(series.length ? Math.max(...series.map((p) => p.bestReps)) : null);
  let metric = $state<'e1rm' | 'kg'>('e1rm');
  const points = $derived(
    series
      .map((p) => ({ day: p.day, v: metric === 'e1rm' || sel?.load === 'bodyweight' ? (p.e1rm ?? NaN) : p.maxKg }))
      .filter((p) => Number.isFinite(p.v)),
  );
  const t = (n: number) => (n >= 1000 ? `${fmtKg(Math.round(n / 100) / 10)} т` : `${Math.round(n)} кг`);
</script>

<div class="stack">
  <section class="card stack">
    <h2 class="section-title">Эта неделя (с {formatDayShort(from)})</h2>
    <div class="row stats">
      <div><b>{week.length}</b><span class="muted small">тренировок</span></div>
      <div><b>{lastWeekCount}</b><span class="muted small">на прошлой</span></div>
      <div><b class:pr={weekRecords}>{weekRecords}</b><span class="muted small">рекордов</span></div>
    </div>
    {#if groups.length}
      <table class="num">
        <thead><tr><th>Группа</th><th>подходы</th><th>объём</th></tr></thead>
        <tbody>
          {#each groups as [g, v] (g)}
            <tr><td>{groupLabel(g)}</td><td>{v.sets}</td><td>{t(v.tonnage)}{v.partial ? '*' : ''}</td></tr>
          {/each}
        </tbody>
      </table>
      <p class="muted small">
        Рабочие подходы по основной группе мышц. Объём = вес × повторы; для подтягиваний и брусьев вес тела + отягощение.
        {#if groups.some(([, v]) => v.partial)}* часть подходов без известного веса тела, объём занижен.{/if}
      </p>
    {:else}
      <p class="muted small">На этой неделе тренировок ещё не было.</p>
    {/if}
  </section>

  {#if used.length}
    <section class="card stack">
      <select bind:value={selId} aria-label="Упражнение">
        {#each used as e (e.id)}<option value={String(e.id)}>{e.name}</option>{/each}
      </select>
      {#if sel && recs}
        <div class="row stats">
          {#if sel.load !== 'bodyweight'}
            <div><b>{recs.maxKg != null ? fmtKg(recs.maxKg) : '—'}</b><span class="muted small">{sel.load === 'bodyweight_plus' ? 'макс. доп. вес' : 'макс. вес'}, кг</span></div>
          {/if}
          <div><b>{bestReps ?? '—'}</b><span class="muted small">макс. повторов</span></div>
          <div><b>{recs.maxE1rm != null ? fmtKg(Math.round(recs.maxE1rm * 10) / 10) : '—'}</b><span class="muted small">1ПМ, оценка</span></div>
        </div>
        <div class="seg">
          <button class:on={metric === 'e1rm'} onclick={() => (metric = 'e1rm')}>1ПМ (оценка)</button>
          {#if sel.load !== 'bodyweight'}<button class:on={metric === 'kg'} onclick={() => (metric = 'kg')}>Макс. вес</button>{/if}
        </div>
        {#if points.length}
          <LineChart {points} label="График: {sel.name}" />
        {:else}
          <p class="muted small">Нет данных для графика{sel.load === 'bodyweight_plus' && metric === 'e1rm' ? ': для 1ПМ нужен вес тела в «Весе»' : ''}.</p>
        {/if}
        <p class="muted small">
          1ПМ по формуле Эпли — оценка, а не реальный максимум; выше ~12 повторов она неточна. Точка = лучший рабочий подход тренировки.
        </p>
      {/if}
    </section>
  {/if}
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

  .pr {
    color: var(--ok);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--fs-sm);
  }

  th,
  td {
    padding: 6px 4px;
    text-align: right;
  }

  th:first-child,
  td:first-child {
    text-align: left;
  }

  thead th {
    color: var(--muted);
    font-weight: normal;
  }
</style>
