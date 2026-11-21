<script lang="ts">
  import type { Snippet } from 'svelte';
  import { categoryLabel, formatEstimate, type Task } from '../lib/logic/tasks';
  import { setDone } from '../lib/repo/tasks';
  import { db } from '../lib/app-db';
  import { act } from '../lib/state.svelte';
  import Icon from './Icon.svelte';

  let {
    task,
    onedit,
    checkable = true,
    actions,
  }: { task: Task; onedit?: (t: Task) => void; checkable?: boolean; actions?: Snippet } = $props();

  const done = $derived(task.status === 'done');
  const meta = $derived(
    [
      categoryLabel(task.category),
      task.timeStart ? (task.timeEnd ? `${task.timeStart}–${task.timeEnd}` : task.timeStart) : '',
      formatEstimate(task.estimateMin),
      task.recurringId != null ? 'повтор' : '',
      task.carriedCount ? `перенос ×${task.carriedCount}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
  );
</script>

<div class="task" class:done>
  {#if checkable}
    <button
      class="check"
      aria-label={done ? 'Отметить невыполненной' : 'Отметить выполненной'}
      aria-pressed={done}
      onclick={() => act(() => setDone(db, task.id!, !done))}
    >
      <span class="box">{#if done}<svg class="tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" pathLength="1" /></svg>{/if}</span>
    </button>
  {/if}
  <button class="body" onclick={() => onedit?.(task)} disabled={!onedit}>
    <span class="title">{#if task.isMit}<span class="star"><Icon name="star" size={14} filled label="приоритет" /></span>{/if}{task.title}</span>
    <span class="meta">{meta}</span>
  </button>
  {#if actions}<div class="actions">{@render actions()}</div>{/if}
</div>

<style>
  .task {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 52px;
  }

  .check {
    width: 48px;
    height: 48px;
    padding: 0;
    border: none;
    background: transparent;
    display: grid;
    place-items: center;
    flex: none;
  }

  .box {
    width: 26px;
    height: 26px;
    border-radius: 8px;
    border: 2px solid var(--muted);
    display: grid;
    place-items: center;
    font-size: 16px;
    font-weight: 700;
    color: var(--accent-text);
    transition: background-color 220ms var(--ease-out), border-color 220ms var(--ease-out);
  }

  .done .box {
    background: var(--accent);
    border-color: var(--accent);
  }

  .body {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    padding: 6px 4px;
    text-align: left;
    display: flex;
    flex-direction: column;
    height: auto;
  }

  .body:disabled {
    opacity: 1;
  }

  .title {
    overflow-wrap: anywhere;
    transition: opacity 220ms var(--ease-out);
  }

  .done .title {
    opacity: 0.6;
    text-decoration: line-through;
  }

  .star {
    color: var(--accent);
    margin-right: 6px;
  }

  .meta {
    font-size: var(--fs-sm);
    color: var(--muted);
  }

  .actions {
    display: flex;
    gap: 6px;
    flex: none;
  }
</style>
