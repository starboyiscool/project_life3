<script lang="ts">
  import ExercisePicker from './ExercisePicker.svelte';
  import { db } from '../../lib/app-db';
  import { act } from '../../lib/state.svelte';
  import type { Exercise, WorkoutTemplate } from '../../lib/logic/gym';
  import { deleteTemplate, saveTemplate } from '../../lib/repo/gym';

  let { template, exercises, onclose }: { template: WorkoutTemplate | null; exercises: Exercise[]; onclose: () => void } = $props();

  let dialog: HTMLDialogElement;
  let t = $state<WorkoutTemplate | null>(null);
  let picking = $state(false);

  $effect(() => {
    if (template) {
      // the prop is a $state proxy, which structuredClone cannot copy
      t = $state.snapshot(template);
      if (!dialog.open) dialog.showModal();
    } else if (dialog?.open) dialog.close();
  });

  const name = (id: number) => exercises.find((e) => e.id === id)?.name ?? 'Удалённое упражнение';
  const valid = $derived(!!t?.name.trim() && t.items.every((i) => i.sets >= 1 && i.repMin >= 1 && i.repMax >= i.repMin));

  function move(i: number, d: -1 | 1) {
    if (!t) return;
    const j = i + d;
    if (j < 0 || j >= t.items.length) return;
    [t.items[i], t.items[j]] = [t.items[j], t.items[i]];
  }

  async function save(e: SubmitEvent) {
    e.preventDefault();
    if (!t || !valid) return;
    const row = $state.snapshot(t);
    if (await act(() => saveTemplate(db, row), 'Шаблон сохранён')) onclose();
  }

  async function remove() {
    if (!t?.id || !confirm(`Удалить шаблон «${t.name}»? Прошлые тренировки останутся.`)) return;
    const id = t.id;
    if (await act(() => deleteTemplate(db, id))) onclose();
  }

  const int = (v: string, fallback: number) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) && n > 0 && n < 100 ? n : fallback;
  };
</script>

<dialog class="sheet" bind:this={dialog} onclose={onclose}>
  {#if t}
    <form class="stack" onsubmit={save}>
      <h2>{t.id ? 'Шаблон' : 'Новый шаблон'}</h2>
      <input bind:value={t.name} placeholder="Название, например «Верх»" aria-label="Название" />
      {#if t.suggestion}<p class="muted small">Это предложение приложения. После сохранения шаблон станет твоим.</p>{/if}
      {#each t.items as it, i (i)}
        <div class="it">
          <div class="row spread">
            <span class="grow nm">{name(it.exerciseId)}</span>
            <button type="button" class="icon-btn sm" disabled={i === 0} onclick={() => move(i, -1)} aria-label="Выше">↑</button>
            <button type="button" class="icon-btn sm" disabled={i === t.items.length - 1} onclick={() => move(i, 1)} aria-label="Ниже">↓</button>
            <button type="button" class="icon-btn sm" onclick={() => t!.items.splice(i, 1)} aria-label="Убрать">✕</button>
          </div>
          <div class="row nums">
            <input value={it.sets} inputmode="numeric" aria-label="Подходы" onchange={(e) => (it.sets = int(e.currentTarget.value, it.sets))} />
            <span class="muted">×</span>
            <input value={it.repMin} inputmode="numeric" aria-label="Повторы от" onchange={(e) => (it.repMin = int(e.currentTarget.value, it.repMin))} />
            <span class="muted">–</span>
            <input value={it.repMax} inputmode="numeric" aria-label="Повторы до" onchange={(e) => (it.repMax = int(e.currentTarget.value, it.repMax))} />
            <span class="muted small">повт.</span>
          </div>
          {#if it.repMax < it.repMin}<span class="small danger">Верх диапазона меньше низа.</span>{/if}
        </div>
      {/each}
      <button type="button" onclick={() => (picking = true)}>+ Упражнение</button>
      <div class="row spread">
        {#if t.id}<button type="button" class="link danger" onclick={remove}>Удалить</button>{:else}<span></span>{/if}
        <div class="row">
          <button type="button" onclick={onclose}>Отмена</button>
          <button type="submit" class="primary" disabled={!valid}>Сохранить</button>
        </div>
      </div>
    </form>
  {/if}
</dialog>

<ExercisePicker
  open={picking}
  {exercises}
  onpick={(id) => {
    picking = false;
    t?.items.push({ exerciseId: id, sets: 3, repMin: 8, repMax: 12 });
  }}
  onclose={() => (picking = false)}
/>

<style>
  .it {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border);
  }

  .nm {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sm {
    min-width: 40px;
    min-height: 40px;
  }

  .nums input {
    width: 64px;
    text-align: center;
  }
</style>
