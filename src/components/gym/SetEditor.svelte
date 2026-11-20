<script lang="ts">
  import { fmtKg, parseKgInput, type LoadType, type SetKind, type WorkSet } from '../../lib/logic/gym';

  let { set, load, onsave, onclose }: { set: WorkSet; load: LoadType; onsave: (s: WorkSet | null) => void; onclose: () => void } = $props();

  let dialog: HTMLDialogElement;
  let kgText = $state('');
  let repsText = $state('');
  let kind = $state<SetKind>('work');
  let failure = $state(false);
  let rpeText = $state('');
  let note = $state('');

  $effect(() => {
    kgText = set.kg ? fmtKg(set.kg) : '';
    repsText = String(set.reps);
    kind = set.kind;
    failure = !!set.failure;
    rpeText = set.rpe ? String(set.rpe).replace('.', ',') : '';
    note = set.note ?? '';
    if (!dialog.open) dialog.showModal();
  });

  const kg = $derived(parseKgInput(kgText));
  const reps = $derived(Number.parseInt(repsText, 10));
  const rpe = $derived(rpeText.trim() ? Number(rpeText.replace(',', '.')) : null);
  const valid = $derived(kg != null && reps > 0 && reps < 1000 && (rpe == null || (rpe >= 1 && rpe <= 10)));

  function save(e: SubmitEvent) {
    e.preventDefault();
    if (!valid) return;
    const s: WorkSet = { kg: load === 'bodyweight' ? 0 : kg!, reps, kind, at: set.at };
    if (failure) s.failure = true;
    if (rpe != null) s.rpe = rpe;
    if (note.trim()) s.note = note.trim();
    onsave(s);
  }

  function remove() {
    if (confirm('Удалить подход?')) onsave(null);
  }
</script>

<dialog class="sheet" bind:this={dialog} onclose={onclose}>
  <form class="stack" onsubmit={save}>
    <h2>Подход</h2>
    <div class="row">
      {#if load !== 'bodyweight'}
        <label class="lbl grow"><span class="muted small">{load === 'bodyweight_plus' ? 'Доп. вес, кг' : 'Вес, кг'}</span><input bind:value={kgText} inputmode="decimal" /></label>
      {/if}
      <label class="lbl grow"><span class="muted small">Повторы</span><input bind:value={repsText} inputmode="numeric" /></label>
      <label class="lbl grow"><span class="muted small">RPE</span><input bind:value={rpeText} inputmode="decimal" placeholder="—" /></label>
    </div>
    <div class="chips">
      <button type="button" class="chip" class:on={kind === 'work'} onclick={() => (kind = 'work')}>Рабочий</button>
      <button type="button" class="chip" class:on={kind === 'warmup'} onclick={() => (kind = 'warmup')}>Разминка</button>
      <button type="button" class="chip" class:on={failure} onclick={() => (failure = !failure)}>До отказа</button>
    </div>
    <input bind:value={note} placeholder="Заметка" aria-label="Заметка" />
    <div class="row spread">
      <button type="button" class="link danger" onclick={remove}>Удалить</button>
      <div class="row">
        <button type="button" onclick={onclose}>Отмена</button>
        <button type="submit" class="primary" disabled={!valid}>Сохранить</button>
      </div>
    </div>
  </form>
</dialog>
