<script lang="ts">
  import StorageWarning from '../components/StorageWarning.svelte';
  import StudyUpcoming from '../components/StudyUpcoming.svelte';
  import TaskRow from '../components/TaskRow.svelte';
  import QuickAdd from '../components/QuickAdd.svelte';
  import TaskEditor from '../components/TaskEditor.svelte';
  import Leftovers from '../components/Leftovers.svelte';
  import HabitChecklist from '../components/HabitChecklist.svelte';
  import WeightInput from '../components/WeightInput.svelte';
  import BackupReminder from '../components/BackupReminder.svelte';
  import NutritionSummary from '../components/food/NutritionSummary.svelte';
  import GymToday from '../components/gym/GymToday.svelte';
  import ReviewReminder from '../components/ReviewReminder.svelte';
  import { db } from '../lib/app-db';
  import { days, live } from '../lib/state.svelte';
  import { ensureRecurring, leftovers, mitStats, tasksForDay } from '../lib/repo/tasks';
  import { MAX_MIT, sortTasks, type Task } from '../lib/logic/tasks';
  import { addDays, formatDayLong } from '../lib/logic/day';
  import { mitStreak } from '../lib/logic/streaks';
  import { go } from '../lib/nav.svelte';

  $effect(() => {
    void ensureRecurring(db, days.today);
  });

  const tasks = live(
    () => {
      const d = days.today;
      return async () => sortTasks(await tasksForDay(db, d));
    },
    [] as Task[],
  );
  const old = live(
    () => {
      const d = days.today;
      return () => leftovers(db, d);
    },
    [] as Task[],
  );
  const streak = live(
    () => {
      const d = days.today;
      return async () => mitStreak(await mitStats(db, addDays(d, -365), d), d);
    },
    { current: 0, best: 0 },
  );

  const mits = $derived(tasks.current.filter((t) => t.isMit));
  const others = $derived(tasks.current.filter((t) => !t.isMit));
  const mitDone = $derived(mits.filter((t) => t.status === 'done').length);

  let editing = $state<Task | null>(null);
  let showOld = $state(false);
</script>

<div class="stack">
  <header class="row spread hero">
    <div>
      <h1>Сегодня</h1>
      <p class="muted small">{formatDayLong(days.today)}</p>
    </div>
    {#if streak.current.current > 0}
      <button class="link small" onclick={() => go('more', 'done')}>Серия MIT: {streak.current.current} дн.</button>
    {/if}
  </header>

  <StorageWarning />
  <StudyUpcoming />
  <BackupReminder />
  <ReviewReminder />

  {#if old.current.length}
    <section class="card stack">
      <div class="row spread">
        <span>Незавершённое с прошлых дней: <b>{old.current.length}</b></span>
        <button class="link" onclick={() => (showOld = !showOld)}>{showOld ? 'Скрыть' : 'Разобрать'}</button>
      </div>
      {#if showOld}<Leftovers tasks={old.current} target={days.today} targetLabel="Сегодня" />{/if}
    </section>
  {/if}

  <section class="card">
    <div class="row spread">
      <h2 class="section-title">Главное</h2>
      {#if mits.length}<span class="muted small">{mitDone} из {mits.length}</span>{/if}
    </div>
    {#if tasks.loaded && mits.length === 0}
      <p class="muted small empty">
        Нет приоритетных задач. Отметьте ★ до трёх главных дел{#if others.length}&nbsp;или
          <button class="link small inline" onclick={() => go('plan')}>спланируйте</button>{/if}.
      </p>
    {/if}
    {#each mits as t (t.id)}<TaskRow task={t} onedit={(x) => (editing = x)} />{/each}
    {#if mits.length > MAX_MIT}
      <p class="muted small">Приоритетных {mits.length}. Больше трёх обычно значит, что главное размывается.</p>
    {/if}
  </section>

  <GymToday tasks={tasks.current} />

  <section class="card stack">
    <h2 class="section-title">Привычки</h2>
    <HabitChecklist />
  </section>

  <section class="card stack">
    <h2 class="section-title">Питание</h2>
    <NutritionSummary />
  </section>

  <section class="card stack">
    <h2 class="section-title">Вес</h2>
    <WeightInput compact />
  </section>

  <section class="card">
    <h2 class="section-title">Остальное</h2>
    {#each others as t (t.id)}<TaskRow task={t} onedit={(x) => (editing = x)} />{/each}
    <div class="qa"><QuickAdd day={days.today} /></div>
  </section>
</div>

<TaskEditor task={editing} onclose={() => (editing = null)} />

<style>
  .hero { background: var(--mesh-terracotta); border: 1px solid var(--border); border-radius: 18px; padding: 18px; }

  .hero .link { color: var(--text); }

  header h1 {
    line-height: 1.1;
  }

  .empty {
    padding: 8px 0;
  }

  .inline {
    min-height: 0;
    padding: 0;
  }

  .qa {
    margin-top: 8px;
  }
</style>
