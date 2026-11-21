<script lang="ts">
  import Icon from './Icon.svelte';
  import { CATEGORIES, type Category, type Task } from '../lib/logic/tasks';
  import { moveTask, removeTask, restoreRemovedTask, updateTask } from '../lib/repo/tasks';
  import { notifyAction } from '../lib/toast.svelte';
  import { db } from '../lib/app-db';
  import { act, days } from '../lib/state.svelte';
  import type { Day } from '../lib/logic/day';

  let { task, onclose }: { task: Task | null; onclose: () => void } = $props();

  let dialog: HTMLDialogElement;
  let title = $state('');
  let isMit = $state(false);
  let category = $state<Category>('other');
  let estimate = $state('');
  let timeStart = $state('');
  let timeEnd = $state('');
  let day = $state<Day | ''>('');

  const ESTIMATES = [0, 15, 30, 45, 60, 90, 120, 180];

  $effect(() => {
    if (task) {
      title = task.title;
      isMit = task.isMit;
      category = task.category;
      estimate = task.estimateMin ? String(task.estimateMin) : '';
      timeStart = task.timeStart ?? '';
      timeEnd = task.timeEnd ?? '';
      day = task.day;
      if (!dialog.open) dialog.showModal();
    } else if (dialog?.open) dialog.close();
  });

  async function save() {
    if (!task?.id || !title.trim()) return;
    const id = task.id;
    const ok = await act(async () => {
      await updateTask(db, id, {
        title: title.trim(),
        isMit,
        category,
        estimateMin: estimate ? Number(estimate) : undefined,
        timeStart: timeStart || undefined,
        timeEnd: timeEnd || undefined,
      });
      if (day !== task.day) await moveTask(db, id, day);
    });
    if (ok) onclose();
  }

  async function remove() {
    if (!task) return;
    const msg = task.recurringId != null ? 'Пропустить эту повторяющуюся задачу на этот день?' : `Удалить задачу «${task.title}»?`;
    if (!confirm(msg)) return;
    const t = $state.snapshot(task);
    if (await act(() => removeTask(db, t))) {
      onclose();
      notifyAction(t.recurringId != null ? 'Повтор пропущен' : 'Задача удалена', 'Отменить', () => act(() => restoreRemovedTask(db, t), 'Задача восстановлена'));
    }
  }
</script>

<dialog bind:this={dialog} onclose={onclose}>
  {#if task}
    <form
      class="stack"
      onsubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <h2>Задача</h2>
      <input bind:value={title} aria-label="Название" />

      <button type="button" class="chip" class:on={isMit} onclick={() => (isMit = !isMit)}><Icon name="star" size={13} filled /> Приоритетная (MIT)</button>

      <div class="chips">
        {#each CATEGORIES as c (c.id)}
          <button type="button" class="chip" class:on={category === c.id} onclick={() => (category = c.id)}>{c.label}</button>
        {/each}
      </div>

      <label class="stack lbl">
        <span class="muted small">Оценка времени</span>
        <select bind:value={estimate}>
          {#each ESTIMATES as m (m)}
            <option value={m ? String(m) : ''}>{m ? (m < 60 ? `${m} мин` : `${m / 60} ч`) : '—'}</option>
          {/each}
        </select>
      </label>

      <div class="row">
        <label class="stack lbl grow"><span class="muted small">Начало</span><input type="time" bind:value={timeStart} /></label>
        <label class="stack lbl grow"><span class="muted small">Конец</span><input type="time" bind:value={timeEnd} /></label>
      </div>

      <div class="stack lbl">
        <span class="muted small">День</span>
        <div class="chips">
          <button type="button" class="chip" class:on={day === days.today} onclick={() => (day = days.today)}>Сегодня</button>
          <button type="button" class="chip" class:on={day === days.tomorrow} onclick={() => (day = days.tomorrow)}>Завтра</button>
          <button type="button" class="chip" class:on={day === ''} onclick={() => (day = '')}>Бэклог</button>
        </div>
        <input type="date" value={day} onchange={(e) => (day = e.currentTarget.value)} aria-label="Дата" />
      </div>

      <div class="row spread">
        <button type="button" class="link danger" onclick={remove}>{task.recurringId != null ? 'Пропустить' : 'Удалить'}</button>
        <div class="row">
          <button type="button" onclick={onclose}>Отмена</button>
          <button type="submit" class="primary">Сохранить</button>
        </div>
      </div>
    </form>
  {/if}
</dialog>

<style>
  dialog {
    width: min(560px, calc(100vw - 24px));
    max-height: calc(100dvh - 24px);
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
    color: var(--text);
  }

  dialog::backdrop {
    background: var(--backdrop);
  }

  .lbl {
    gap: 4px;
  }

  .danger {
    color: var(--danger);
  }
</style>
