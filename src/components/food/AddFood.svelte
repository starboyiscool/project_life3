<script lang="ts">
  import FoodFields, { emptyDraft, foodOf, type FoodDraft } from './FoodFields.svelte';
  import { db } from '../../lib/app-db';
  import { act, live } from '../../lib/state.svelte';
  import { notify } from '../../lib/toast.svelte';
  import type { Day } from '../../lib/logic/day';
  import {
    dishAsFood,
    fmt1,
    forGrams,
    parseNum,
    quickPicks,
    searchByName,
    type Dish,
    type Food,
  } from '../../lib/logic/nutrition';
  import { addFood, listDishes, listFoods, logDish, logFood, logManual, logRecentFood, recentFoodPortions, updateFood } from '../../lib/repo/nutrition';

  let { day, meal, onclose }: { day: Day; meal: string | null; onclose: () => void } = $props();

  type Base = { name: string; favorite: boolean; useCount: number; lastUsedAt?: string; createdAt?: string };
  type Item = (Base & { kind: 'food'; food: Food }) | (Base & { kind: 'dish'; dish: Dish });

  const base = (x: Food | Dish): Base => ({
    name: x.name,
    favorite: x.favorite,
    useCount: x.useCount,
    lastUsedAt: x.lastUsedAt,
    createdAt: x.createdAt,
  });

  const data = live(
    () => async () => {
      const [foods, dishes] = await Promise.all([listFoods(db), listDishes(db)]);
      return [
        ...dishes.map((d): Item => ({ ...base(d), kind: 'dish', dish: d })),
        ...foods.map((f): Item => ({ ...base(f), kind: 'food', food: f })),
      ];
    },
    [] as Item[],
  );

  const recent = live(() => () => recentFoodPortions(db), [] as { food: Food; grams: number }[]);

  let dialog: HTMLDialogElement;
  let searchInput = $state<HTMLInputElement>();
  let mode = $state<'search' | 'amount' | 'new' | 'manual'>('search');
  let query = $state('');
  let picked = $state<Food | null>(null);
  let gramsText = $state('');
  let draft = $state<FoodDraft>(emptyDraft());
  let manual = $state({ name: '', kcal: '', p: '', f: '', c: '' });
  let added = $state<string[]>([]);
  let quickBusy = $state(false);

  const list = $derived(query.trim() ? searchByName(data.current, query).slice(0, 30) : quickPicks(data.current, 15));
  const grams = $derived(parseNum(gramsText));
  const preview = $derived(picked && grams ? forGrams(picked.per100, grams) : null);

  $effect(() => {
    if (meal != null) {
      if (!dialog.open) {
        reset();
        dialog.showModal();
        focusSearch();
      }
    } else if (dialog?.open) dialog.close();
  });

  function reset() {
    mode = 'search';
    query = '';
    picked = null;
    added = [];
  }

  function focusSearch() {
    setTimeout(() => searchInput?.focus(), 50);
  }

  function back() {
    mode = 'search';
    picked = null;
    focusSearch();
  }

  function pickFood(f: Food) {
    picked = f;
    gramsText = String(f.lastGrams ?? f.portionG ?? 100);
    mode = 'amount';
  }

  async function addPicked(e?: SubmitEvent) {
    e?.preventDefault();
    if (!picked || !grams || meal == null) return;
    // a $state proxy cannot be stored in IndexedDB (DataCloneError)
    const f = $state.snapshot(picked);
    const g = grams;
    if (await act(() => logFood(db, day, meal, f, g))) {
      added = [...added, `${f.name}, ${g} г`];
      query = '';
      back();
    }
  }

  async function quickAddFood(f: Food, grams: number) {
    if (quickBusy || meal == null || f.id == null || !Number.isFinite(grams) || grams <= 0) return;
    quickBusy = true;
    const food = $state.snapshot(f);
    const g = grams;
    try {
      if (await act(() => logRecentFood(db, day, meal!, food.id!, g))) added = [...added, `${food.name}, ${g} г`];
    } finally { quickBusy = false; }
  }

  async function addDish(d: Dish) {
    if (meal == null) return;
    if (await act(() => logDish(db, day, meal, d))) {
      added = [...added, d.name];
      query = '';
      focusSearch();
    }
  }

  async function saveNew(e: SubmitEvent) {
    e.preventDefault();
    const f = foodOf(draft);
    if (!f) return;
    let id = 0;
    if (!(await act(async () => (id = await addFood(db, f))))) return;
    pickFood({ ...f, id, favorite: false, useCount: 0, createdAt: '' });
  }

  async function addManual(e: SubmitEvent) {
    e.preventDefault();
    const kcal = parseNum(manual.kcal);
    if (kcal == null || meal == null) return;
    const g = (v: string) => parseNum(v) ?? 0;
    const name = manual.name.trim() || 'Без названия';
    const total = { kcal: Math.round(kcal), p: g(manual.p), f: g(manual.f), c: g(manual.c) };
    if (await act(() => logManual(db, day, meal, name, total))) {
      added = [...added, `${name}, ${total.kcal} ккал`];
      manual = { name: '', kcal: '', p: '', f: '', c: '' };
      back();
    }
  }

  function toggleFav(f: Food) {
    const fav = !f.favorite;
    picked = { ...f, favorite: fav };
    act(() => updateFood(db, f.id!, { favorite: fav }));
    notify(fav ? 'В избранном' : 'Убрано из избранного', 'info', 1500);
  }
</script>

<dialog class="sheet" bind:this={dialog} onclose={onclose}>
  {#if meal != null}
    <div class="stack">
      <div class="row spread">
        <h2>{meal}</h2>
        <button class="link" onclick={onclose}>Готово</button>
      </div>
      {#if added.length}<p class="muted small">Добавлено: {added.join('; ')}</p>{/if}

      {#if mode === 'search'}
        <input bind:this={searchInput} bind:value={query} placeholder="Поиск продукта или блюда" autocomplete="off" aria-label="Поиск" />
        {#if !query.trim() && recent.current.length}
          <span class="section-title">Повторить порцию</span>
          <div class="chips">
            {#each recent.current as r (`${r.food.id}:${r.grams}`)}
              <button class="quick small" disabled={quickBusy} aria-label="Добавить {r.food.name}, {r.grams} г" onclick={() => quickAddFood(r.food, r.grams)}>+ {r.food.name} · {fmt1(r.grams)} г</button>
            {/each}
          </div>
        {/if}
        {#if !query.trim() && data.loaded && list.length}<span class="section-title">Избранное и недавние</span>{/if}
        <div class="list">
          {#each list as it (it.kind + (it.kind === 'food' ? it.food.id : it.dish.id))}
            {#if it.kind === 'food'}
              <button class="item" onclick={() => pickFood(it.food)}>
                <span class="grow name">{it.favorite ? '★ ' : ''}{it.name}</span>
                <span class="muted small num">{Math.round(it.food.per100.kcal)} ккал/100 г</span>
              </button>
            {:else}
              <button class="item" onclick={() => addDish(it.dish)}>
                <span class="grow name">{it.favorite ? '★ ' : ''}{it.name} <span class="tag">блюдо</span></span>
                <span class="muted small num">+ {dishAsFood(it.dish.items).total.kcal} ккал</span>
              </button>
            {/if}
          {/each}
          {#if data.loaded && !list.length}
            <p class="muted small">
              {query.trim() ? 'Не найдено.' : 'База пока пустая. Добавь продукт, он запомнится и в следующий раз найдётся.'}
            </p>
          {/if}
        </div>
        <div class="row wrap">
          <button
            onclick={() => {
              draft = emptyDraft(query.trim());
              mode = 'new';
            }}>+ Новый продукт{query.trim() ? ` «${query.trim()}»` : ''}</button
          >
          <button
            onclick={() => {
              manual.name = query.trim();
              mode = 'manual';
            }}>Вручную (ккал)</button
          >
        </div>
      {:else if mode === 'amount' && picked}
        <form class="stack" onsubmit={addPicked}>
          <div class="row spread">
            <b>{picked.name}</b>
            <button type="button" class="link" onclick={() => toggleFav(picked!)} aria-label="Избранное">{picked.favorite ? '★' : '☆'}</button>
          </div>
          <span class="muted small num">
            На 100 г: {Math.round(picked.per100.kcal)} ккал · Б {fmt1(picked.per100.p)} · Ж {fmt1(picked.per100.f)} · У {fmt1(picked.per100.c)}
          </span>
          <div class="row">
            <input class="grams" bind:value={gramsText} inputmode="decimal" aria-label="Граммы" />
            <span class="muted">г</span>
            {#if preview}<span class="grow num right"><b>{preview.kcal}</b> ккал</span>{/if}
          </div>
          <div class="chips">
            {#if picked.portionG}
              <button type="button" class="chip" onclick={() => (gramsText = String(picked!.portionG))}>{picked.portionName} ({picked.portionG} г)</button>
              <button type="button" class="chip" onclick={() => (gramsText = String(picked!.portionG! * 2))}>× 2</button>
            {/if}
            {#each [50, 100, 150, 200] as g (g)}
              <button type="button" class="chip" onclick={() => (gramsText = String(g))}>{g} г</button>
            {/each}
          </div>
          {#if preview}<span class="muted small num">Б {fmt1(preview.p)} · Ж {fmt1(preview.f)} · У {fmt1(preview.c)}</span>{/if}
          <div class="row spread">
            <button type="button" onclick={back}>← Назад</button>
            <button type="submit" class="primary" disabled={!grams}>Добавить</button>
          </div>
        </form>
      {:else if mode === 'new'}
        <form class="stack" onsubmit={saveNew}>
          <FoodFields bind:draft />
          <p class="muted small">Значения с упаковки, на 100 г. Белки, жиры и углеводы можно не заполнять.</p>
          <div class="row spread">
            <button type="button" onclick={back}>← Назад</button>
            <button type="submit" class="primary" disabled={!foodOf(draft)}>Сохранить в базу</button>
          </div>
        </form>
      {:else if mode === 'manual'}
        <form class="stack" onsubmit={addManual}>
          <input bind:value={manual.name} placeholder="Что это (необяз.)" aria-label="Название" />
          <div class="grid">
            <label class="lbl"><span class="muted small">Ккал *</span><input bind:value={manual.kcal} inputmode="decimal" /></label>
            <label class="lbl"><span class="muted small">Белки</span><input bind:value={manual.p} inputmode="decimal" /></label>
            <label class="lbl"><span class="muted small">Жиры</span><input bind:value={manual.f} inputmode="decimal" /></label>
            <label class="lbl"><span class="muted small">Углев.</span><input bind:value={manual.c} inputmode="decimal" /></label>
          </div>
          <div class="row spread">
            <button type="button" onclick={back}>← Назад</button>
            <button type="submit" class="primary" disabled={parseNum(manual.kcal) == null}>Добавить</button>
          </div>
        </form>
      {/if}
    </div>
  {/if}
</dialog>

<style>
  .quick { min-height: 44px; padding: 0 12px; color: var(--accent); }
  dialog.sheet {
    margin-top: 12px;
    max-height: calc(100dvh - 24px);
    overflow-y: auto;
  }

  .list {
    display: flex;
    flex-direction: column;
    max-height: 46dvh;
    overflow-y: auto;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: left;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    border-radius: 0;
    padding: 0 4px;
    min-height: 52px;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tag {
    font-size: 0.75rem;
    color: var(--muted);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0 5px;
  }

  .wrap {
    flex-wrap: wrap;
  }

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
