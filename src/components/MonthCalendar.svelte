<script lang="ts">
  import Icon from './Icon.svelte';
  import { db } from '../lib/app-db';
  import { live, days, settings } from '../lib/state.svelte';
  import { addDays, weekday, formatDayShort, type Day, WEEKDAYS_SHORT } from '../lib/logic/day';
  import { calendarCounts, type CalendarFilter } from '../lib/logic/calendar';
  import { semesterWeekRange, isControlWeek, workWeekRange } from '../lib/logic/semester';
  import type { Subject, Work } from '../lib/logic/study';
  import type { Workout } from '../lib/logic/gym';
  import type { RecurringTask, Task } from '../lib/logic/tasks';
  let { day, onselect, filter }: { day: Day; onselect: (day: Day) => void; filter: CalendarFilter } = $props();
  let month = $state(new Date().toISOString().slice(0, 7));
  $effect(() => { month = day.slice(0, 7); });
  const cells = $derived.by(() => {
    const first = `${month}-01`;
    const start = addDays(first, -weekday(first));
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  });
  const monthLabel = $derived(new Intl.DateTimeFormat('ru-RU', {month:'long', year:'numeric', timeZone:'UTC'}).format(new Date(`${month}-01T00:00:00Z`)));
  const visibleWeeks = $derived.by(() => {
    if (filter !== 'study' || !settings.semesterStart) return [];
    return Array.from({length: 52}, (_, i) => ({week: i + 1, range: semesterWeekRange(settings.semesterStart, i + 1)!}))
      .filter(x => x.range.from <= cells[41] && x.range.to >= cells[0]);
  });
  const entries = live(() => {
    const dates = cells, mode = filter, start = settings.semesterStart, number = settings.semesterNumber;
    return async () => {
      const rows = await db.table<Task, number>('tasks').where('day').between(dates[0], dates[41], true, true).toArray();
      const rules = await db.table<RecurringTask, number>('recurring').toArray();
      const counts = calendarCounts(dates, rows, rules, mode);
      if (mode === 'all' || mode === 'training') {
        const workouts = await db.table<Workout, number>('workouts').where('day').between(dates[0], dates[41], true, true).toArray();
        const taskDays = new Set(rows.filter(t => t.category === 'training' && (t.status === 'open' || t.status === 'done')).map(t => t.day));
        for (const d of new Set(workouts.map(w => w.day))) if (!taskDays.has(d)) counts[d] = (counts[d] ?? 0) + 1;
      }
      const deadlines: Record<string, number> = {};
      if (mode === 'all' || mode === 'study') {
        const works = await db.table<Work, number>('works').toArray();
        const subjects = await db.table<Subject, number>('subjects').toArray();
        for (const w of works) {
          if (w.status === 'passed') continue;
          const range = workWeekRange(w, subjects.find(s => s.id === w.subjectId), number, start);
          for (const d of dates) {
            if (w.deadline === d || (!w.deadline && mode === 'study' && range && d >= range.from && d <= range.to)) deadlines[d] = (deadlines[d] ?? 0) + 1;
          }
        }
      }
      return {counts, deadlines};
    };
  }, {counts: {} as Record<string, number>, deadlines: {} as Record<string, number>});
  function changeMonth(delta: number) {
    const [year, m] = month.split('-').map(Number);
    month = new Date(Date.UTC(year, m - 1 + delta, 1)).toISOString().slice(0, 7);
  }
</script>
<section class="card calendar" aria-label="Календарь задач">
  <div class="cal-head"><button class="icon-btn" aria-label="Предыдущий месяц" onclick={() => changeMonth(-1)}><Icon name="back" /></button><h2>{monthLabel}</h2><button class="icon-btn" aria-label="Следующий месяц" onclick={() => changeMonth(1)}><Icon name="forward" /></button></div>
  <div class="grid weekdays" aria-hidden="true">{#each WEEKDAYS_SHORT as w (w)}<span>{w}</span>{/each}</div>
  <div class="grid">{#each cells as d, i (i)}<button class="date" class:outside={!d.startsWith(month)} class:selected={d === day} class:today={d === days.today} aria-label={`${d}, задач: ${entries.current.counts[d] ?? 0}, учебных работ: ${entries.current.deadlines[d] ?? 0}`} aria-pressed={d === day} onclick={() => onselect(d)}><span>{Number(d.slice(-2))}</span><span class="count">{#if entries.current.counts[d] || entries.current.deadlines[d]}{entries.current.counts[d] ?? 0}{#if entries.current.deadlines[d]} · У{entries.current.deadlines[d]}{/if}{:else}&nbsp;{/if}</span></button>{/each}</div>
  <p class="muted small">Число — задачи и повторы; «У» — учебные работы. Выберите день для плана.</p>
  {#if filter === 'study'}
    {#if !settings.semesterStart}<p class="muted small">Чтобы увидеть учебные недели, укажите начало семестра в настройках.</p>
    {:else if visibleWeeks.length}<div class="week-list"><span class="muted small">Учебные недели:</span>{#each visibleWeeks as item (item.week)}<span class:control={isControlWeek(item.week)}>{item.week}-я: {formatDayShort(item.range.from)}–{formatDayShort(item.range.to)}{#if isControlWeek(item.week)} · контрольная{/if}</span>{/each}</div>{/if}
  {/if}
</section>
<style>
 .calendar { display: grid; gap: 8px; } .cal-head {display:grid; grid-template-columns:48px minmax(0,1fr) 48px; align-items:center; text-align:center;} .cal-head h2 { text-transform: capitalize; } .cal-head button { font-size: var(--fs-xl); line-height: 1; display:grid; place-items:center; }
 .grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 3px; text-align: center; }
 .weekdays { color: var(--muted); font-size: var(--fs-sm); }
 .date { padding: 2px; min-width: 0; min-height: 46px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0; border-color: transparent; background: transparent; line-height: 1.1; }
 .date.outside { color: var(--muted); } .date.today { border-color: var(--accent); } .date.selected { background: var(--surface-2); border-color: var(--accent); font-weight: 700; }
 .count { color: var(--muted); font-size: var(--fs-xs); }
 .week-list {display:flex; flex-wrap:wrap; gap: 6px 12px; font-size: var(--fs-sm);} .week-list span {display:inline-block;} .control {color:var(--accent); font-weight:700;}
</style>
