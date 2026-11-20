<script lang="ts">
  import { db } from '../lib/app-db';
  import { days, live } from '../lib/state.svelte';
  import { doneBetween, mitStats } from '../lib/repo/tasks';
  import { addDays, relativeDayLabel, type Day } from '../lib/logic/day';
  import { mitStreak, type MitDayStat } from '../lib/logic/streaks';
  import { categoryLabel, CATEGORIES, sortTasks, type Task } from '../lib/logic/tasks';

  const RANGE_DAYS = 30;

  const data = live(
    () => {
      const today = days.today;
      return async () => {
        const done = await doneBetween(db, addDays(today, -(RANGE_DAYS - 1)), today);
        const stats = await mitStats(db, addDays(today, -365), today);
        return { done, stats, today };
      };
    },
    { done: [] as Task[], stats: {} as Record<Day, MitDayStat>, today: '' },
  );

  const streak = $derived(mitStreak(data.current.stats, data.current.today || days.today));

  const week = $derived.by(() => {
    let withMit = 0;
    let success = 0;
    for (let i = 0; i < 7; i++) {
      const s = data.current.stats[addDays(days.today, -i)];
      if (s && s.mit > 0) {
        withMit++;
        if (s.mitDone >= s.mit) success++;
      }
    }
    return { withMit, success };
  });

  const byDay = $derived.by(() => {
    const map = new Map<Day, Task[]>();
    for (const t of data.current.done) {
      const arr = map.get(t.day) ?? [];
      arr.push(t);
      map.set(t.day, arr);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([day, ts]) => ({ day, tasks: sortTasks(ts) }));
  });

  const weekByCategory = $derived.by(() => {
    const from = addDays(days.today, -6);
    const counts = new Map<string, number>();
    for (const t of data.current.done) if (t.day >= from) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
    return CATEGORIES.filter((c) => counts.has(c.id)).map((c) => ({ label: c.label, n: counts.get(c.id)! }));
  });
</script>

<div class="stack">
  <section class="card stack">
    <h2 class="section-title">Все MIT выполнены</h2>
    <div class="row stats">
      <div><b>{streak.current}</b><span class="muted small">серия, дн.</span></div>
      <div><b>{streak.best}</b><span class="muted small">лучшая</span></div>
      <div><b>{week.success}/{week.withMit}</b><span class="muted small">за 7 дней</span></div>
    </div>
    <p class="muted small">Дни без приоритетных задач серию не прерывают.</p>
  </section>

  {#if weekByCategory.length}
    <section class="card stack">
      <h2 class="section-title">За 7 дней</h2>
      <div class="chips">
        {#each weekByCategory as c (c.label)}<span class="chip on static">{c.label}: {c.n}</span>{/each}
      </div>
    </section>
  {/if}

  {#if data.loaded && byDay.length === 0}<p class="muted">Пока ничего не выполнено за {RANGE_DAYS} дней.</p>{/if}
  {#each byDay as g (g.day)}
    <section class="card">
      <div class="row spread">
        <h2 class="section-title">{relativeDayLabel(g.day, days.today)}</h2>
        <span class="muted small">{g.tasks.length}</span>
      </div>
      <ul>
        {#each g.tasks as t (t.id)}
          <li>
            {#if t.isMit}<span class="star">★</span>{/if}{t.title}
            <span class="muted small">· {categoryLabel(t.category)}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</div>

<style>
  .stats {
    justify-content: space-around;
    text-align: center;
  }

  .stats div {
    display: flex;
    flex-direction: column;
  }

  .stats b {
    font-size: 1.5rem;
  }

  ul {
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .star {
    color: var(--accent);
    margin-right: 6px;
  }

  .static {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--border);
  }
</style>
