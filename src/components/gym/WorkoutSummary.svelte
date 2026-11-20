<script lang="ts">
  import type { useGym } from '../../lib/gym-data.svelte';
  import { before, markRecords, setText, type Workout } from '../../lib/logic/gym';

  let { workout, gym }: { workout: Workout; gym: ReturnType<typeof useGym> } = $props();

  const marks = $derived(markRecords(workout, before(gym.data.done, workout), gym.exMap, gym.body));
  const tpl = $derived(gym.data.templates.find((t) => t.id === workout.templateId));
  const minutes = $derived(
    workout.finishedAt ? Math.round((Date.parse(workout.finishedAt) - Date.parse(workout.startedAt)) / 60000) : null,
  );
</script>

<div class="stack sum">
  <span class="muted small">
    {tpl?.name ?? 'Без шаблона'}{#if minutes && minutes < 600}&nbsp;· {minutes} мин{/if}{#if marks.size}&nbsp;· <span class="pr">★ рекордов: {marks.size}</span>{/if}
  </span>
  {#each workout.items as it, i (i)}
    {@const load = gym.exMap.get(it.exerciseId)?.load ?? 'barbell'}
    <div class="small">
      <b>{gym.name(it.exerciseId)}</b>:
      {#each it.sets as s, j (j)}<span class:muted={s.kind === 'warmup'} class:pr={marks.has(`${i}:${j}`)}>{j ? ', ' : ''}{setText(s, load)}</span>{/each}
    </div>
  {/each}
  {#if workout.note}<p class="muted small">{workout.note}</p>{/if}
</div>

<style>
  .sum {
    gap: 4px;
  }

  .pr {
    color: var(--ok);
  }
</style>
