<script lang="ts">
  import { db } from '../lib/app-db';
  import { act, days, live } from '../lib/state.svelte';
  import { addDays, formatDayShort, weekStart, WEEKDAYS_SHORT } from '../lib/logic/day';
  import { emptyReview, taskWeekStats, weekEnd, type WeekReview } from '../lib/logic/review';
  import { goalForDay, periodSummary } from '../lib/logic/nutrition';
  import { formatKg, formatSigned, movingAverage, weeklyTrend } from '../lib/logic/weight';
  import { before, bodyWeightOn, markRecords } from '../lib/logic/gym';
  import { weekProgress } from '../lib/logic/streaks';
  import { describeSchedule } from '../lib/logic/habits';
  import { getReview, saveReview, tasksBetween } from '../lib/repo/study';
  import { entriesBetween, listGoals } from '../lib/repo/nutrition';
  import { listWeights } from '../lib/repo/weights';
  import { listDone, listExercises } from '../lib/repo/gym';
  import { habitDoneDays, listHabits } from '../lib/repo/habits';

  /** Monday of the shown week. Sunday and Monday open on the week being reviewed. */
  let week = $state(weekStart(days.today === weekStart(days.today) ? addDays(days.today, -1) : days.today));
  const end = $derived(weekEnd(week));
  const isCurrent = $derived(week === weekStart(days.today));

  const data = live(
    () => {
      const from = week;
      const to = weekEnd(week);
      const upTo = to < days.today ? to : days.today;
      return async () => {
        const [tasks, food, goals, weights, done, exercises, habits, habitDays, review, prevReview] = await Promise.all([
          tasksBetween(db, from, to),
          entriesBetween(db, from, upTo),
          listGoals(db),
          listWeights(db),
          listDone(db),
          listExercises(db),
          listHabits(db),
          habitDoneDays(db, from, to),
          getReview(db, from),
          getReview(db, addDays(from, -7)),
        ]);
        const nutrition = periodSummary(food, from, upTo);
        const goalDays = nutrition.days.filter((d) => d.entries).map((d) => goalForDay(goals, d.day)?.kcal).filter((x): x is number => x != null);
        const wUpTo = weights.filter((w) => w.day <= to);
        const ma = movingAverage(wUpTo).at(-1);
        const exMap = new Map(exercises.map((e) => [e.id!, e]));
        const body = (d: string) => bodyWeightOn(weights, d);
        const weekWorkouts = done.filter((w) => w.day >= from && w.day <= to);
        const records = weekWorkouts.reduce((a, w) => a + markRecords(w, before(done, w), exMap, body).size, 0);
        return {
          tasks: taskWeekStats(tasks, days.today),
          nutrition,
          goalKcal: goalDays.length ? Math.round(goalDays.reduce((a, b) => a + b, 0) / goalDays.length) : null,
          weightAvg: ma && ma.day >= addDays(from, -7) ? ma.avg : null,
          weightTrend: weeklyTrend(wUpTo),
          weighIns: weights.filter((w) => w.day >= from && w.day <= to).length,
          workouts: weekWorkouts.length,
          records,
          habits: habits.map((h) => ({ h, p: weekProgress(habitDays.get(h.id!) ?? new Set(), upTo, h.schedule, h.startDay) })),
          review: review ?? emptyReview(from),
          prevGoals: (prevReview?.goals ?? []).filter((g) => g.trim()),
        };
      };
    },
    null,
  );

  // editable copy of the review, refreshed when the week changes or the data first arrives
  let form = $state<WeekReview>(emptyReview(''));
  let loadedFor = '';
  $effect(() => {
    const r = data.current?.review;
    if (r && loadedFor !== r.week) {
      loadedFor = r.week;
      form = { ...r, goals: [...r.goals, '', '', ''].slice(0, 3) };
    }
  });

  async function save(e: SubmitEvent) {
    e.preventDefault();
    const r = $state.snapshot(form);
    await act(() => saveReview(db, { ...r, goals: r.goals.map((g) => g.trim()), worked: r.worked.trim(), didnt: r.didnt.trim() }), 'Обзор сохранён');
  }

  const maxKcal = $derived(Math.max(1, ...(data.current?.nutrition.days.map((d) => d.total.kcal) ?? [0]), data.current?.goalKcal ?? 0));
</script>

<div class="stack">
  <div class="row spread">
    <button class="icon-btn" aria-label="Предыдущая неделя" onclick={() => (week = addDays(week, -7))}>‹</button>
    <b>{formatDayShort(week)} — {formatDayShort(end)}{isCurrent ? ' (эта)' : ''}</b>
    <button class="icon-btn" aria-label="Следующая неделя" disabled={isCurrent} onclick={() => (week = addDays(week, 7))}>›</button>
  </div>

  {#if data.current}
    {@const d = data.current}
    {#if d.prevGoals.length}
      <section class="card stack">
        <h2 class="section-title">Цели, поставленные на эту неделю</h2>
        <ol class="goals">{#each d.prevGoals as g, i (i)}<li>{g}</li>{/each}</ol>
      </section>
    {/if}

    <section class="card stack">
      <h2 class="section-title">Задачи</h2>
      <div class="row stats">
        <div><b>{d.tasks.done}</b><span class="muted small">выполнено</span></div>
        <div><b>{d.tasks.open}</b><span class="muted small">не сделано</span></div>
        <div><b>{d.tasks.doneCarried + d.tasks.openCarried}</b><span class="muted small">переносились</span></div>
      </div>
    </section>

    <section class="card stack">
      <h2 class="section-title">Питание</h2>
      {#if d.nutrition.avg}
        <p class="small">
          В среднем <b>{d.nutrition.avg.kcal} ккал</b> · Б {Math.round(d.nutrition.avg.p)} · Ж {Math.round(d.nutrition.avg.f)} · У {Math.round(d.nutrition.avg.c)}
          {#if d.goalKcal}&nbsp;· цель {d.goalKcal} ({formatSigned(d.nutrition.avg.kcal - d.goalKcal, 0)}){/if}
        </p>
        <div class="bars" aria-label="Калории по дням">
          {#each d.nutrition.days as x, i (x.day)}
            <div class="col">
              <div class="b" class:empty={!x.entries} style="height: {Math.round((x.total.kcal / maxKcal) * 70)}px"></div>
              <span class="muted small">{WEEKDAYS_SHORT[i]}</span>
            </div>
          {/each}
          {#if d.goalKcal}<div class="goal" style="bottom: calc(18px + {(d.goalKcal / maxKcal) * 70}px)"></div>{/if}
        </div>
        <p class="muted small">Записано дней: {d.nutrition.filledDays} из {d.nutrition.days.length}; среднее по записанным.</p>
      {:else}
        <p class="muted small">Записей за неделю нет.</p>
      {/if}
    </section>

    <section class="card stack">
      <h2 class="section-title">Вес и зал</h2>
      <p class="small">
        Среднее за 7 дн.: <b>{d.weightAvg != null ? `${formatKg(d.weightAvg)} кг` : '—'}</b> · тренд:
        <b>{d.weightTrend != null ? `${formatSigned(d.weightTrend)} кг/нед` : '—'}</b> · замеров: {d.weighIns}
      </p>
      <p class="small">Тренировок: <b>{d.workouts}</b> · рекордов: <b class:ok={d.records}>{d.records}</b></p>
    </section>

    {#if d.habits.length}
      <section class="card stack">
        <h2 class="section-title">Привычки</h2>
        {#each d.habits as x (x.h.id)}
          <div class="row spread small">
            <span>{x.h.name} <span class="muted">({describeSchedule(x.h.schedule)})</span></span>
            <span class="num">{x.p.done}/{x.p.target}</span>
          </div>
        {/each}
      </section>
    {/if}

    <form class="card stack" onsubmit={save}>
      <h2 class="section-title">Цели на следующую неделю</h2>
      {#each [0, 1, 2] as i (i)}
        <input bind:value={form.goals[i]} placeholder="{i + 1}." aria-label="Цель {i + 1}" />
      {/each}
      <label class="lbl"><span class="muted small">Что сработало</span><textarea bind:value={form.worked} rows="2"></textarea></label>
      <label class="lbl"><span class="muted small">Что нет</span><textarea bind:value={form.didnt} rows="2"></textarea></label>
      <button type="submit" class="primary">Сохранить</button>
    </form>
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
    font-size: 1.4rem;
  }

  .ok {
    color: var(--ok);
  }

  .goals {
    margin: 0;
    padding-left: 20px;
  }

  .bars {
    position: relative;
    display: flex;
    gap: 6px;
    height: 88px;
    align-items: flex-end;
  }

  .col {
    flex: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    gap: 2px;
  }

  .col span {
    line-height: 16px;
  }

  .col .b {
    width: 100%;
    min-height: 2px;
    background: var(--accent);
    border-radius: 4px 4px 0 0;
  }

  .col .b.empty {
    background: var(--border);
  }

  .bars .goal {
    position: absolute;
    left: 0;
    right: 0;
    border-top: 1px dashed var(--muted);
  }

  textarea {
    font: inherit;
    color: inherit;
    padding: 8px 12px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--bg);
    resize: vertical;
  }
</style>
