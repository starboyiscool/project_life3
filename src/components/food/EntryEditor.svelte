<script lang="ts">
  import { db } from '../../lib/app-db';
  import { act } from '../../lib/state.svelte';
  import { fmt1, forGrams, parseNum, type FoodEntry } from '../../lib/logic/nutrition';
  import { deleteEntry, updateEntry } from '../../lib/repo/nutrition';

  let { entry, meals, onclose }: { entry: FoodEntry | null; meals: string[]; onclose: () => void } = $props();

  let dialog: HTMLDialogElement;
  let gramsText = $state('');
  let m = $state({ kcal: '', p: '', f: '', c: '' });
  let meal = $state('');

  const byGrams = $derived(!!entry?.per100 && entry.grams != null);
  const grams = $derived(parseNum(gramsText));
  const preview = $derived(entry?.per100 && grams ? forGrams(entry.per100, grams) : null);
  const allMeals = $derived(entry && !meals.includes(entry.meal) ? [...meals, entry.meal] : meals);

  $effect(() => {
    if (entry) {
      gramsText = entry.grams != null ? String(entry.grams) : '';
      m = { kcal: String(entry.total.kcal), p: fmt1(entry.total.p), f: fmt1(entry.total.f), c: fmt1(entry.total.c) };
      meal = entry.meal;
      if (!dialog.open) dialog.showModal();
    } else if (dialog?.open) dialog.close();
  });

  async function save(e: SubmitEvent) {
    e.preventDefault();
    if (!entry?.id) return;
    let changes: Partial<FoodEntry> = { meal };
    if (byGrams) {
      if (!grams || !preview) return;
      changes = { ...changes, grams, total: preview };
    } else {
      const kcal = parseNum(m.kcal);
      if (kcal == null) return;
      changes = { ...changes, total: { kcal: Math.round(kcal), p: parseNum(m.p) ?? 0, f: parseNum(m.f) ?? 0, c: parseNum(m.c) ?? 0 } };
    }
    const id = entry.id;
    if (await act(() => updateEntry(db, id, changes))) onclose();
  }

  async function remove() {
    if (!entry?.id || !confirm(`Удалить «${entry.name}» из дневника?`)) return;
    const id = entry.id;
    if (await act(() => deleteEntry(db, id))) onclose();
  }
</script>

<dialog class="sheet" bind:this={dialog} onclose={onclose}>
  {#if entry}
    <form class="stack" onsubmit={save}>
      <h2>{entry.name}</h2>
      {#if byGrams}
        <div class="row">
          <input class="grams" bind:value={gramsText} inputmode="decimal" aria-label="Граммы" />
          <span class="muted">г</span>
          {#if preview}<span class="grow num right"><b>{preview.kcal}</b> ккал · Б {fmt1(preview.p)} · Ж {fmt1(preview.f)} · У {fmt1(preview.c)}</span>{/if}
        </div>
      {:else}
        <div class="grid">
          <label class="lbl"><span class="muted small">Ккал</span><input bind:value={m.kcal} inputmode="decimal" /></label>
          <label class="lbl"><span class="muted small">Белки</span><input bind:value={m.p} inputmode="decimal" /></label>
          <label class="lbl"><span class="muted small">Жиры</span><input bind:value={m.f} inputmode="decimal" /></label>
          <label class="lbl"><span class="muted small">Углев.</span><input bind:value={m.c} inputmode="decimal" /></label>
        </div>
      {/if}
      <div class="chips">
        {#each allMeals as x (x)}
          <button type="button" class="chip" class:on={meal === x} onclick={() => (meal = x)}>{x}</button>
        {/each}
      </div>
      <div class="row spread">
        <button type="button" class="link danger" onclick={remove}>Удалить</button>
        <div class="row">
          <button type="button" onclick={onclose}>Отмена</button>
          <button type="submit" class="primary">Сохранить</button>
        </div>
      </div>
    </form>
  {/if}
</dialog>

<style>
  .grams {
    width: 110px;
    font-size: 1.2rem;
  }

  .right {
    text-align: right;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
  }

  .grid input {
    padding: 0 8px;
  }
</style>
