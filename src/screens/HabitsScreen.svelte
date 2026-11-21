<script lang="ts">
  import { db } from '../lib/app-db';
  import { act, days, live } from '../lib/state.svelte';
  import { addHabit, habitDoneDays, listHabits, setHabitDone, updateHabit } from '../lib/repo/habits';
  import { addDays, weekday, WEEKDAYS_SHORT, type Day } from '../lib/logic/day';
  import { dailyStreak, weekProgress, weeklyStreak } from '../lib/logic/streaks';
  import { describeSchedule, type Habit, type HabitSchedule } from '../lib/logic/habits';

  const data = live(
    () => {
      const today = days.today;
      return async () => ({
        habits: await listHabits(db, true),
        done: await habitDoneDays(db, addDays(today, -400), today),
      });
    },
    { habits: [] as Habit[], done: new Map<number, Set<Day>>() },
  );

  const active = $derived(data.current.habits.filter((h) => !h.archived));
  const archived = $derived(data.current.habits.filter((h) => h.archived));
  const last7 = $derived(Array.from({ length: 7 }, (_, i) => addDays(days.today, i - 6)));

  function stats(h: Habit) {
    const set = data.current.done.get(h.id!) ?? new Set<Day>();
    const streak = h.schedule.type === 'daily' ? dailyStreak(set, days.today, h.startDay) : weeklyStreak(set, h.schedule.times, days.today);
    const wp = weekProgress(set, days.today, h.schedule, h.startDay);
    return { set, streak, wp, unit: h.schedule.type === 'daily' ? 'дн.' : 'нед.' };
  }

  let name = $state('');
  let kind = $state<HabitSchedule['type']>('daily');
  let times = $state(3);

  async function add(e: SubmitEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const schedule: HabitSchedule = kind === 'daily' ? { type: 'daily' } : { type: 'weekly', times: Math.min(7, Math.max(1, times)) };
    if (await act(() => addHabit(db, { name, schedule }, days.today))) name = '';
  }

  function rename(h: Habit) {
    const n = prompt('Название привычки', h.name)?.trim();
    if (n && n !== h.name) act(() => updateHabit(db, h.id!, { name: n }));
  }

  function archive(h: Habit, value: boolean) {
    if (value && !confirm(`Убрать «${h.name}» в архив? История сохранится.`)) return;
    act(() => updateHabit(db, h.id!, { archived: value }));
  }
</script>

<div class="stack">

  {#if data.loaded && active.length === 0}
    <p class="muted">Привычек пока нет. Добавьте первую ниже.</p>
  {/if}

  {#each active as h (h.id)}
    {@const s = stats(h)}
    <section class="card stack">
      <div class="row spread">
        <button class="link title" onclick={() => rename(h)}>{h.name}</button>
        <span class="muted small">{describeSchedule(h.schedule)}</span>
      </div>
      <div class="days">
        {#each last7 as d (d)}
          {@const on = s.set.has(d)}
          <button
            class="day"
            class:on
            class:today={d === days.today}
            aria-pressed={on}
            aria-label="{WEEKDAYS_SHORT[weekday(d)]} {d}"
            onclick={() =>
              act(async () => {
                // marking a day before the habit existed moves its start back
                if (!on && d < h.startDay) await updateHabit(db, h.id!, { startDay: d });
                await setHabitDone(db, h.id!, d, !on);
              })}
          >
            {WEEKDAYS_SHORT[weekday(d)]}
          </button>
        {/each}
      </div>
      <div class="row spread small">
        <span class="muted">Серия: <b class="val">{s.streak.current}</b> {s.unit} · лучшая {s.streak.best}</span>
        <span class="muted">неделя {s.wp.done}/{s.wp.target}</span>
      </div>
      <div class="bar"><i style:--p={(Math.round(s.wp.ratio * 100)) / 100}></i></div>
      <div class="row">
        <button class="link small" onclick={() => archive(h, true)}>В архив</button>
      </div>
    </section>
  {/each}

  <form class="card stack" onsubmit={add}>
    <h2 class="section-title">Новая привычка</h2>
    <input bind:value={name} placeholder="Например: вода 2 л" aria-label="Название" />
    <div class="seg">
      <button type="button" class:on={kind === 'daily'} onclick={() => (kind = 'daily')}>Каждый день</button>
      <button type="button" class:on={kind === 'weekly'} onclick={() => (kind = 'weekly')}>N раз в неделю</button>
    </div>
    {#if kind === 'weekly'}
      <label class="row"><input type="number" min="1" max="7" bind:value={times} class="n" /><span class="muted">раз в неделю</span></label>
    {/if}
    <button type="submit" class="primary" disabled={!name.trim()}>Добавить</button>
  </form>

  {#if archived.length}
    <details class="card">
      <summary class="muted">Архив ({archived.length})</summary>
      {#each archived as h (h.id)}
        <div class="row spread arch">
          <span>{h.name}</span>
          <button class="small" onclick={() => archive(h, false)}>Вернуть</button>
        </div>
      {/each}
    </details>
  {/if}
</div>

<style>
  .title {
    padding: 0;
    color: var(--text);
    font-size: var(--fs-md);
    font-weight: 600;
    text-align: left;
  }

  .days {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }

  .day {
    padding: 0;
    min-height: 44px;
    font-size: var(--fs-sm);
    color: var(--muted);
    background: transparent;
  }

  .day.today {
    border-color: var(--muted);
  }

  .day.on {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-text);
  }

  .val {
    color: var(--text);
  }

  .n {
    width: 80px;
  }

  .arch {
    min-height: 52px;
  }

  summary {
    cursor: pointer;
    min-height: 32px;
  }
</style>
