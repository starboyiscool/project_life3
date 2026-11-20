<script lang="ts">
  import WorkoutView from './WorkoutView.svelte';
  import WorkoutSummary from './WorkoutSummary.svelte';
  import { db } from '../../lib/app-db';
  import { act, days } from '../../lib/state.svelte';
  import { useGym } from '../../lib/gym-data.svelte';
  import { addDays, formatDayLong } from '../../lib/logic/day';
  import { deleteWorkout, startWorkout } from '../../lib/repo/gym';

  const gym = useGym();

  let openId = $state<number | null>(null);
  const opened = $derived(openId == null ? null : (gym.data.done.find((w) => w.id === openId) ?? null));

  let pastDay = $state(addDays(days.today, -1));
  let pastTpl = $state<string>('');
  let limit = $state(30);

  /** A past workout left without sets would count in the schedule, so it is not kept. */
  async function close() {
    const w = opened;
    openId = null;
    if (w && !w.items.some((i) => i.sets.length)) await act(() => deleteWorkout(db, w.id!), 'Пустая тренировка не сохранена');
  }

  async function addPast(e: SubmitEvent) {
    e.preventDefault();
    if (!pastDay || pastDay > days.today) return;
    const t = gym.data.templates.find((x) => String(x.id) === pastTpl) ?? null;
    let id = 0;
    if (await act(async () => (id = await startWorkout(db, pastDay, t, true)))) openId = id;
  }
</script>

{#if opened}
  <WorkoutView workout={opened} onclose={close} />
{:else}
  <div class="stack">
    {#if gym.loaded && !gym.data.done.length}
      <p class="muted">Завершённых тренировок пока нет.</p>
    {/if}
    {#each gym.data.done.slice(0, limit) as w (w.id)}
      <button class="card item" onclick={() => (openId = w.id!)}>
        <b>{formatDayLong(w.day)}</b>
        <WorkoutSummary workout={w} {gym} />
      </button>
    {/each}
    {#if gym.data.done.length > limit}
      <button onclick={() => (limit += 30)}>Показать ещё</button>
    {/if}

    <details class="card">
      <summary>Записать прошедшую тренировку</summary>
      <form class="stack opts" onsubmit={addPast}>
        <input type="date" bind:value={pastDay} max={days.today} aria-label="Дата" />
        <select bind:value={pastTpl} aria-label="Шаблон">
          <option value="">Без шаблона</option>
          {#each gym.data.templates as t (t.id)}<option value={String(t.id)}>{t.name}</option>{/each}
        </select>
        <button type="submit" class="primary">Создать и заполнить</button>
        <p class="muted small">Таймер отдыха в этом режиме не запускается.</p>
      </form>
    </details>
  </div>
{/if}

<style>
  .item {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    text-align: left;
    height: auto;
    gap: 4px;
    padding: 12px 14px;
  }

  summary {
    cursor: pointer;
    min-height: 32px;
    color: var(--muted);
  }

  .opts {
    margin-top: 12px;
  }
</style>
