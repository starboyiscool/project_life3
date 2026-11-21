<script lang="ts">
  import Icon from './Icon.svelte';
  import { db } from '../lib/app-db';
  import { act, days, live } from '../lib/state.svelte';
  import { habitDoneDays, listHabits, setHabitDone } from '../lib/repo/habits';
  import { weekStart, addDays } from '../lib/logic/day';
  import { weekProgress } from '../lib/logic/streaks';
  import { go } from '../lib/nav.svelte';

  const data = live(
    () => {
      const today = days.today;
      return async () => {
        const habits = await listHabits(db);
        const done = await habitDoneDays(db, weekStart(today), addDays(weekStart(today), 6));
        return { habits, done, today };
      };
    },
    { habits: [], done: new Map(), today: '' },
    'today-habits',
  );
</script>

{#if data.loaded}
  {#if data.current.habits.length === 0}
    <button class="link small add" onclick={() => go('more', 'habits')}><Icon name="plus" size={16} /> Добавить привычки</button>
  {:else}
    <div class="chips">
      {#each data.current.habits as h (h.id)}
        {@const set = data.current.done.get(h.id!) ?? new Set()}
        {@const on = set.has(data.current.today)}
        {@const wp = weekProgress(set, data.current.today, h.schedule, h.startDay)}
        <button
          class="chip habit"
          class:on
          aria-pressed={on}
          onclick={() => act(() => setHabitDone(db, h.id!, data.current.today, !on))}
        >
          {#if on}<svg class="tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" pathLength="1" /></svg>{/if}{h.name}{#if h.schedule.type === 'weekly'}<span class="muted cnt">{wp.done}/{wp.target}</span>{/if}
        </button>
      {/each}
    </div>
  {/if}
{/if}

<style>
  .habit {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .habit.on {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-text);
  }

  .cnt {
    margin-left: 6px;
  }

  .habit.on .muted {
    color: var(--accent-text);
  }

  .add {
    padding: 0;
    min-height: 32px;
  }
</style>
