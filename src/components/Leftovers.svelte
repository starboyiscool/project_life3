<script lang="ts">
  import Icon from './Icon.svelte';
  import TaskRow from './TaskRow.svelte';
  import { moveTask, removeTask } from '../lib/repo/tasks';
  import { db } from '../lib/app-db';
  import { act } from '../lib/state.svelte';
  import { formatDayShort, type Day } from '../lib/logic/day';
  import type { Task } from '../lib/logic/tasks';

  let { tasks, target, targetLabel }: { tasks: Task[]; target: Day; targetLabel: string } = $props();

  // A recurring instance is not carried (the rule creates its own); it can only be skipped.
  const movable = $derived(tasks.filter((t) => t.recurringId == null));

  function moveAll() {
    act(async () => {
      for (const t of movable) await moveTask(db, t.id!, target);
    });
  }
</script>

<div class="stack">
  {#each tasks as t (t.id)}
    <div class="item">
      <TaskRow task={t} />
      <div class="row acts">
        <span class="muted small grow">{formatDayShort(t.day)}</span>
        {#if t.recurringId == null}
          <button class="small" onclick={() => act(() => moveTask(db, t.id!, target))}><Icon name="arrowRight" size={16} /> {targetLabel}</button>
          <button class="small" onclick={() => act(() => moveTask(db, t.id!, ''))}>В бэклог</button>
        {:else}
          <button class="small" onclick={() => act(() => removeTask(db, t))}>Пропустить</button>
        {/if}
      </div>
    </div>
  {/each}
  {#if movable.length > 1}
    <button class="primary" onclick={moveAll}>Все ({movable.length}) → {targetLabel}</button>
  {/if}
</div>

<style>
  .item {
    border-bottom: 1px solid var(--border);
    padding-bottom: 8px;
  }

  .acts {
    padding-left: 52px;
  }

  button.small {
    padding: 0 12px;
  }
</style>
