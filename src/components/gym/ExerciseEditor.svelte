<script lang="ts">
  import { db } from '../../lib/app-db';
  import { act, gymSettings } from '../../lib/state.svelte';
  import { notify } from '../../lib/toast.svelte';
  import { fmtKg, LOAD_TYPES, MUSCLE_GROUPS, type Exercise, type MuscleGroup } from '../../lib/logic/gym';
  import { removeExercise, saveExercise } from '../../lib/repo/gym';

  let { exercise, onclose }: { exercise: Exercise | null; onclose: () => void } = $props();

  let dialog: HTMLDialogElement;
  let e = $state<Exercise | null>(null);
  let stepText = $state('');
  let restText = $state('');

  $effect(() => {
    if (exercise) {
      e = { ...exercise, secondary: [...exercise.secondary] };
      stepText = exercise.stepKg != null ? fmtKg(exercise.stepKg) : '';
      restText = exercise.restSec != null ? String(exercise.restSec / 60).replace('.', ',') : '';
      if (!dialog.open) dialog.showModal();
    } else if (dialog?.open) dialog.close();
  });

  const optNum = (t: string, min: number, max: number): number | undefined | null => {
    if (!t.trim()) return undefined;
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  };
  const step = $derived(optNum(stepText, 0.25, 50));
  const restMin = $derived(optNum(restText, 0.25, 15));
  const valid = $derived(!!e?.name.trim() && step !== null && restMin !== null);

  function toggleSecondary(g: MuscleGroup) {
    if (!e) return;
    e.secondary = e.secondary.includes(g) ? e.secondary.filter((x) => x !== g) : [...e.secondary, g];
  }

  async function save(ev: SubmitEvent) {
    ev.preventDefault();
    if (!e || !valid) return;
    const row: Exercise = {
      ...$state.snapshot(e),
      secondary: e.secondary.filter((g) => g !== e!.primary),
      stepKg: step ?? undefined,
      restSec: restMin != null ? Math.round(restMin * 60) : undefined,
    };
    if (await act(() => saveExercise(db, row), 'Сохранено')) onclose();
  }

  async function remove() {
    if (!e?.id || !confirm(`Удалить «${e.name}»?`)) return;
    const id = e.id;
    let r = '';
    if (await act(async () => (r = await removeExercise(db, id)))) {
      if (r === 'archived') notify('Упражнение есть в истории или шаблонах, поэтому оно убрано в архив, а не удалено.', 'info', 4000);
      onclose();
    }
  }
</script>

<dialog class="sheet" bind:this={dialog} onclose={onclose}>
  {#if e}
    <form class="stack" onsubmit={save}>
      <h2>{e.id ? 'Упражнение' : 'Новое упражнение'}</h2>
      <input bind:value={e.name} placeholder="Название" aria-label="Название" />
      <span class="muted small">Основная группа</span>
      <div class="chips">
        {#each MUSCLE_GROUPS as g (g.id)}
          <button type="button" class="chip" class:on={e.primary === g.id} onclick={() => (e!.primary = g.id)}>{g.label}</button>
        {/each}
      </div>
      <span class="muted small">Вторичные</span>
      <div class="chips">
        {#each MUSCLE_GROUPS.filter((g) => g.id !== e!.primary) as g (g.id)}
          <button type="button" class="chip" class:on={e.secondary.includes(g.id)} onclick={() => toggleSecondary(g.id)}>{g.label}</button>
        {/each}
      </div>
      <span class="muted small">Отягощение</span>
      <div class="chips">
        {#each LOAD_TYPES as l (l.id)}
          <button type="button" class="chip" class:on={e.load === l.id} onclick={() => (e!.load = l.id)}>{l.label}</button>
        {/each}
      </div>
      <div class="chips">
        <button type="button" class="chip" class:on={e.compound} onclick={() => (e!.compound = true)}>Базовое</button>
        <button type="button" class="chip" class:on={!e.compound} onclick={() => (e!.compound = false)}>Изолирующее</button>
      </div>
      <div class="row">
        <label class="lbl grow"><span class="muted small">Шаг, кг</span><input bind:value={stepText} inputmode="decimal" placeholder={fmtKg(gymSettings.stepKg)} /></label>
        <label class="lbl grow"><span class="muted small">Отдых, мин</span>
          <input bind:value={restText} inputmode="decimal" placeholder={String((e.compound ? gymSettings.restCompoundSec : gymSettings.restIsolationSec) / 60).replace('.', ',')} /></label>
      </div>
      <p class="muted small">Пустые поля — значения из настроек зала. Единицы: кг.</p>
      <div class="row spread">
        {#if e.id}<button type="button" class="link danger" onclick={remove}>Удалить</button>{:else}<span></span>{/if}
        <div class="row">
          <button type="button" onclick={onclose}>Отмена</button>
          <button type="submit" class="primary" disabled={!valid}>Сохранить</button>
        </div>
      </div>
    </form>
  {/if}
</dialog>
