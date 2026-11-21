<script lang="ts">
  import { db } from '../../lib/app-db';
  import { days, live } from '../../lib/state.svelte';
  import { addDays, formatDayShort } from '../../lib/logic/day';
  import { goalForDay, periodSummary, type NutritionGoal } from '../../lib/logic/nutrition';
  import { entriesBetween, listGoals } from '../../lib/repo/nutrition';
  import { formatSigned } from '../../lib/logic/weight';

  // the last 7 complete days: today is still in progress and would pull the average down
  const data = live(
    () => {
      const to = addDays(days.today, -1);
      const from = addDays(to, -6);
      return async () => ({ s: periodSummary(await entriesBetween(db, from, to), from, to), goals: await listGoals(db) });
    },
    { s: null, goals: [] } as { s: ReturnType<typeof periodSummary> | null; goals: NutritionGoal[] },
  );

  const keys = ['kcal', 'p', 'f', 'c'] as const;

  type Row = Record<(typeof keys)[number], number>;

  /** Goal and deviation averaged over the filled days that already had a goal. */
  const cmp = $derived.by(() => {
    const s = data.current.s;
    if (!s) return null;
    const pairs = s.days
      .filter((d) => d.entries)
      .map((d) => ({ d, g: goalForDay(data.current.goals, d.day) }))
      .filter((x) => !!x.g);
    if (!pairs.length) return null;
    const mean = (f: (x: (typeof pairs)[number]) => number) => pairs.reduce((a, x) => a + f(x), 0) / pairs.length;
    const goal = Object.fromEntries(keys.map((k) => [k, mean((x) => x.g![k])])) as Row;
    const dev = Object.fromEntries(keys.map((k) => [k, mean((x) => x.d.total[k] - x.g![k])])) as Row;
    return { goal, dev, n: pairs.length, all: pairs.length === s.filledDays };
  });

  const r = (n: number) => Math.round(n);
</script>

{#if data.current.s}
  {@const s = data.current.s}
  <div class="stack">
    <p class="muted small">Последние 7 полных дней (сегодня не учитывается). Записано дней: <b>{s.filledDays} из 7</b>, приёмов пищи: {s.meals}.</p>
    <div class="card tbl">
      <table class="num">
        <thead>
          <tr><th></th><th>ккал</th><th>Б</th><th>Ж</th><th>У</th></tr>
        </thead>
        <tbody>
          {#each s.days as d (d.day)}
            <tr class:empty={!d.entries}>
              <td>{formatDayShort(d.day)}</td>
              {#if d.entries}
                <td>{d.total.kcal}</td><td>{r(d.total.p)}</td><td>{r(d.total.f)}</td><td>{r(d.total.c)}</td>
              {:else}
                <td colspan="4" class="muted">не записано</td>
              {/if}
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr>
            <th>Среднее</th>
            {#each keys as k (k)}<th>{s.avg ? r(s.avg[k]) : '—'}</th>{/each}
          </tr>
          {#if cmp}
            <tr class="muted">
              <td>Цель</td>
              {#each keys as k (k)}<td>{r(cmp.goal[k])}</td>{/each}
            </tr>
            <tr>
              <td>Отклонение</td>
              {#each keys as k (k)}
                <td>{formatSigned(r(cmp.dev[k]), 0)}<br /><span class="muted small">{formatSigned(r((cmp.dev[k] / (cmp.goal[k] || 1)) * 100), 0)}%</span></td>
              {/each}
            </tr>
          {/if}
        </tfoot>
      </table>
    </div>
    {#if !cmp}<p class="muted small">Цели не заданы, поэтому отклонение не считается. Задать цели можно в «Расчёте».</p>
    {:else if !cmp.all}<p class="muted small">Цель и отклонение посчитаны по {cmp.n} дн., в которые цель уже действовала.</p>{/if}
    <p class="muted small">Среднее считается только по записанным дням.</p>
  </div>
{/if}

<style>
  .tbl {
    padding: 8px;
    overflow-x: auto;
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
    vertical-align: top;
  }

  th:first-child,
  td:first-child {
    text-align: left;
  }

  td[colspan] {
    text-align: center;
  }

  thead th {
    color: var(--muted);
    font-weight: normal;
  }

  tfoot tr:first-child th,
  tfoot tr:first-child td {
    border-top: 1px solid var(--border);
  }

  tr.empty td:first-child {
    color: var(--muted);
  }
</style>
