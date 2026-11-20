<script lang="ts">
  import { db, setMeta } from '../lib/app-db';
  import { act, days, live } from '../lib/state.svelte';
  import { addDays, calendarDay, diffDays } from '../lib/logic/day';
  import { exportAll } from '../lib/export';

  const REMIND_EVERY_DAYS = 7;

  const state = live(
    () => () =>
      db.transaction('r', db.tables, async () => {
        const last = (await db.table('meta').get('lastExportAt'))?.value as string | undefined;
        const snooze = (await db.table('meta').get('backupSnoozeUntil'))?.value as string | undefined;
        let hasData = false;
        for (const t of ['tasks', 'weights', 'habits']) if ((await db.table(t).count()) > 0) hasData = true;
        return { last, snooze, hasData };
      }),
    { last: undefined, snooze: undefined, hasData: false } as { last?: string; snooze?: string; hasData: boolean },
  );

  const daysSince = $derived(state.current.last ? diffDays(calendarDay(new Date(state.current.last)), days.today) : null);
  const due = $derived(
    state.loaded &&
      state.current.hasData &&
      (daysSince === null || daysSince >= REMIND_EVERY_DAYS) &&
      !(state.current.snooze && state.current.snooze > days.today),
  );
</script>

{#if due}
  <div class="card row spread reminder">
    <span class="small">
      {daysSince === null ? 'Бэкапа ещё не было' : `Бэкап был ${daysSince} дн. назад`}
    </span>
    <div class="row">
      <button class="link" onclick={() => act(() => setMeta('backupSnoozeUntil', addDays(days.today, 1)))}>Завтра</button>
      <button class="primary" onclick={() => act(exportAll, 'Экспорт готов: файл в «Загрузках».')}>Экспорт</button>
    </div>
  </div>
{/if}

<style>
  .reminder {
    padding: 8px 8px 8px 16px;
    border-color: var(--accent);
  }
</style>
