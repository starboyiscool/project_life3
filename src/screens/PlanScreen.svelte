<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import StudyDayEvents from '../components/StudyDayEvents.svelte';
  import { matchesFilter, type CalendarFilter } from '../lib/logic/calendar';
  import type { Workout } from '../lib/logic/gym';
  import { go } from '../lib/nav.svelte';
  import MonthCalendar from '../components/MonthCalendar.svelte';
  import TaskRow from '../components/TaskRow.svelte';
  import QuickAdd from '../components/QuickAdd.svelte';
  import TaskEditor from '../components/TaskEditor.svelte';
  import Leftovers from '../components/Leftovers.svelte';
  import RecurringList from '../components/RecurringList.svelte';
  import { db } from '../lib/app-db';
  import { act, days, live } from '../lib/state.svelte';
  import { backlog, ensureRecurring, leftovers, moveTask, tasksForDay } from '../lib/repo/tasks';
  import { formatEstimate, MAX_MIT, sortTasks, totalMinutes, type Task } from '../lib/logic/tasks';
  import { addDays, formatDayLong, relativeDayLabel, type Day } from '../lib/logic/day';

  type Seg = 'day' | 'backlog' | 'recurring';
  let seg = $state<Seg>('day');
  let filter = $state<CalendarFilter>('all');
  let editing = $state<Task | null>(null);
  let planDay = $state<Day>(days.tomorrow);

  /** Soft hint, never a block: a day loaded beyond this looks over-full. */
  const OVERLOAD_MIN = 8 * 60;

  $effect(() => {
    void ensureRecurring(db, planDay);
  });

  const planned = live(
    () => {
      const d = planDay;
      return async () => sortTasks(await tasksForDay(db, d));
    },
    [] as Task[],
  );
  const unfinished = live(
    () => {
      const d = planDay;
      return () => leftovers(db, d);
    },
    [] as Task[],
  );
  const later = live(() => async () => sortTasks(await backlog(db)), [] as Task[]);

  const filtered = $derived(planned.current.filter(t => matchesFilter(t.category, filter)));
  const visibleOld = $derived(unfinished.current.filter(t => matchesFilter(t.category, filter)));
  const workouts = live(() => { const d = planDay; return () => db.table<Workout, number>('workouts').where('day').equals(d).toArray(); }, [] as Workout[]);
  const mitCount = $derived(planned.current.filter((t) => t.isMit).length);
  const totalMin = $derived(totalMinutes(planned.current));
  const showLeftovers = $derived(planDay > days.today);

  function prevDay() {
    planDay = addDays(planDay, -1);
  }
  function nextDay() {
    planDay = addDays(planDay, 1);
  }
  function onDate(e: Event) {
    const v = (e.currentTarget as HTMLInputElement).value;
    if (v) planDay = v;
  }
</script>

<div class="stack">
  <h1>Календарь</h1>
  <div class="seg" role="tablist">
    <button class:on={seg === 'day'} onclick={() => (seg = 'day')}>День</button>
    <button class:on={seg === 'backlog'} onclick={() => (seg = 'backlog')}>
      Бэклог{#if later.current.length}&nbsp;<span class="muted">{later.current.length}</span>{/if}
    </button>
    <button class:on={seg === 'recurring'} onclick={() => (seg = 'recurring')}>Повторы</button>
  </div>

  {#if seg === 'day'}
    <div class="filters" role="group" aria-label="Фильтр календаря">
      <button class:on={filter === 'all'} aria-pressed={filter === 'all'} onclick={() => filter = 'all'}>Всё</button>
      <button class:on={filter === 'study'} aria-pressed={filter === 'study'} onclick={() => filter = 'study'}>Учёба</button>
      <button class:on={filter === 'training'} aria-pressed={filter === 'training'} onclick={() => filter = 'training'}>Тренировки</button>
      <button class:on={filter === 'other'} aria-pressed={filter === 'other'} onclick={() => filter = 'other'}>Дела</button>
    </div>
    <MonthCalendar day={planDay} {filter} onselect={(d) => planDay = d} />
    {#if filter === 'all' || filter === 'study'}<StudyDayEvents day={planDay} includeWeek={filter === 'study'} />{/if}
    {#if (filter === 'all' || filter === 'training') && workouts.current.length}<section class="card row spread"><span>Тренировок за день: {workouts.current.length}</span><button onclick={() => go('gym', 'history')}>История</button></section>{/if}
    <section class="card stack">
      <div class="daynav">
        <button class="icon-btn" aria-label="Предыдущий день" onclick={prevDay}>‹</button>
        <div class="grow daylabel">
          <b>{relativeDayLabel(planDay, days.today)}</b>
          <span class="muted small">{formatDayLong(planDay)}</span>
        </div>
        <button class="icon-btn" aria-label="Следующий день" onclick={nextDay}>›</button>
      </div>

      <div class="row controls">
        <input type="date" value={planDay} onchange={onDate} aria-label="Дата" />
        <button class="chip" class:on={planDay === days.today} onclick={() => (planDay = days.today)}>Сегодня</button>
        <button class="chip" class:on={planDay === days.tomorrow} onclick={() => (planDay = days.tomorrow)}>Завтра</button>
      </div>

      <div class="row spread summary">
        <span class="muted small">За день: <Icon name="star" size={13} filled /> {mitCount} из {MAX_MIT}</span>
        {#if totalMin > 0}<span class="muted small">≈ {formatEstimate(totalMin)}</span>{/if}
      </div>

      {#each filtered as t (t.id)}<TaskRow task={t} checkable={false} onedit={(x) => (editing = x)} />{/each}

      {#if mitCount > MAX_MIT}
        <p class="muted small">Приоритетных {mitCount}. Может, часть сделать обычными?</p>
      {/if}
      {#if totalMin > OVERLOAD_MIN}
        <p class="muted small">Запланировано ≈ {formatEstimate(totalMin)} — это много на один день. Часть можно отправить в бэклог.</p>
      {/if}

      <div class="qa"><QuickAdd day={planDay} initialCategory={filter === 'study' || filter === 'training' ? filter : 'other'} placeholder="Добавить задачу…" /></div>
    </section>

    {#if showLeftovers && visibleOld.length}
      <section class="card stack">
        <h2 class="section-title">Не сделано сегодня и раньше</h2>
        <Leftovers tasks={visibleOld} target={planDay} targetLabel={relativeDayLabel(planDay, days.today)} />
      </section>
    {/if}
  {:else if seg === 'backlog'}
    <section class="card">
      {#if later.loaded && later.current.length === 0}<p class="muted">Бэклог пуст.</p>{/if}
      {#each later.current as t (t.id)}
        <div class="item">
          <TaskRow task={t} checkable={false} onedit={(x) => (editing = x)} />
          <div class="row acts">
            <button class="small" onclick={() => act(() => moveTask(db, t.id!, days.today))}>→ Сегодня</button>
            <button class="small" onclick={() => act(() => moveTask(db, t.id!, days.tomorrow))}>→ Завтра</button>
          </div>
        </div>
      {/each}
      <div class="qa"><QuickAdd day="" placeholder="В бэклог…" /></div>
    </section>
  {:else}
    <RecurringList startDay={planDay} />
  {/if}
</div>

<TaskEditor task={editing} onclose={() => (editing = null)} />

<style>
  .filters { display: flex; flex-wrap: wrap; gap: 6px; }
  .filters button { flex: 1; padding: 0 10px; min-height: 44px; }
  .filters button.on { background: var(--surface-2); border-color: var(--accent); font-weight: 700; }
  .qa {
    margin-top: 8px;
  }

  .item {
    border-bottom: 1px solid var(--border);
    padding-bottom: 8px;
  }

  .acts {
    padding-left: 4px;
    justify-content: flex-end;
  }

  .daynav { display: grid; grid-template-columns: 48px minmax(0, 1fr) 48px; align-items: center; gap: 8px; }

  .daynav .icon-btn {
    flex: none;
    font-size: var(--fs-xl);
    line-height: 1;
    display: grid; place-items: center;
  }

  .daylabel {
    display: flex;
    flex-direction: column;
    text-align: center;
    line-height: 1.25;
  }

  .controls {
    flex-wrap: wrap;
    align-items: center;
  }

  .controls input[type='date'] {
    width: auto;
    min-width: 160px;
    flex: 1;
  }

  .summary {
    border-top: 1px solid var(--border);
    padding-top: 10px;
  }
</style>
