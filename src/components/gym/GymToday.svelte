<script lang="ts">
  import { days } from '../../lib/state.svelte';
  import { useGym } from '../../lib/gym-data.svelte';
  import { go } from '../../lib/nav.svelte';
  import type { Task } from '../../lib/logic/tasks';
  import { before, markRecords } from '../../lib/logic/gym';
  import { hasTrainingOnDay } from '../../lib/logic/calendar';

  let { tasks }: { tasks: Task[] } = $props();
  const gym = useGym();
  const planned = $derived(tasks.filter(t => t.day === days.today && t.category === 'training' && (t.status === 'open' || t.status === 'done')));
  const activeToday = $derived(gym.data.active?.day === days.today ? gym.data.active : null);
  const today = $derived(gym.data.done.find((w) => w.day === days.today));
  const show = $derived(hasTrainingOnDay(days.today, tasks, [...gym.data.done, ...(gym.data.active ? [gym.data.active] : [])]));
  const recs = $derived(today ? markRecords(today, before(gym.data.done, today), gym.exMap, gym.body).size : 0);

</script>

{#if gym.loaded && show}
<section class="card stack">
  <h2 class="section-title">Тренировка</h2>
  {#if activeToday}
    <div class="row spread">
      <span>Тренировка идёт</span>
      <button class="primary" onclick={() => go('gym', 'now')}>Продолжить</button>
    </div>
  {:else if today}
    <div class="row spread">
      <span>
        Сделано: {today.items.length} упр.{#if recs}&nbsp;· <span class="pr">★ {recs}</span>{/if}
      </span>
      <button class="link" onclick={() => go('gym', 'history')}>Подробнее</button>
    </div>
  {:else}
    {#each planned as task (task.id)}
      <div class="row spread">
        <span>{task.status === 'done' ? 'Выполнено' : 'В календаре'}: {task.title}</span>
        <button class="link" onclick={() => go('gym', 'now')}>В зал</button>
      </div>
    {/each}
  {/if}
</section>
{/if}

<style>
  .pr {
    color: var(--ok);
  }
</style>
