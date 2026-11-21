<script lang="ts">
  import Icon from '../Icon.svelte';
  import FoodFields, { draftOf, emptyDraft, foodOf, type FoodDraft } from './FoodFields.svelte';
  import { db } from '../../lib/app-db';
  import Pane from '../Pane.svelte';
  import { act, live } from '../../lib/state.svelte';
  import { notify } from '../../lib/toast.svelte';
  import { dishAsFood, fmt1, parseFoodCsv, parseNum, searchByName, type Dish, type DishItem, type Food } from '../../lib/logic/nutrition';
  import { addFood, deleteDish, deleteFood, importFoods, listDishes, listFoods, saveDish, updateFood } from '../../lib/repo/nutrition';

  let tab = $state<'foods' | 'dishes'>('foods');
  let query = $state('');

  const foods = live(() => () => listFoods(db), [] as Food[]);
  const dishes = live(() => () => listDishes(db), [] as Dish[]);

  const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, 'ru');
  const shownFoods = $derived(query.trim() ? searchByName(foods.current, query) : [...foods.current].sort(byName));
  const shownDishes = $derived(query.trim() ? searchByName(dishes.current, query) : [...dishes.current].sort(byName));

  // ---- food editor ----
  let foodDialog: HTMLDialogElement;
  let editFood = $state<Food | null>(null);
  let draft = $state<FoodDraft>(emptyDraft());

  function openFood(f: Food | null) {
    editFood = f;
    draft = f ? draftOf(f) : emptyDraft(query.trim());
    foodDialog.showModal();
  }

  async function saveFood(e: SubmitEvent) {
    e.preventDefault();
    const f = foodOf(draft);
    if (!f) return;
    const id = editFood?.id;
    const ok = await act(() =>
      id != null ? updateFood(db, id, { ...f, portionName: f.portionName, portionG: f.portionG }) : addFood(db, f),
    );
    if (ok) foodDialog.close();
  }

  async function removeFood() {
    if (!editFood?.id || !confirm(`Удалить «${editFood.name}» из базы? Записи в дневнике и блюда не изменятся.`)) return;
    const id = editFood.id;
    if (await act(() => deleteFood(db, id))) foodDialog.close();
  }

  // ---- dish editor ----
  let dishDialog: HTMLDialogElement;
  let editDish = $state<Dish | null>(null);
  let dishName = $state('');
  let items = $state<(DishItem & { gramsText: string })[]>([]);
  let itemQuery = $state('');
  const itemHits = $derived(searchByName(foods.current, itemQuery).slice(0, 6));
  const dishItems = $derived(items.map((i) => ({ ...i, grams: parseNum(i.gramsText) ?? 0 })));
  const dishTotal = $derived(dishAsFood(dishItems));

  function openDish(d: Dish | null) {
    editDish = d;
    dishName = d?.name ?? '';
    items = (d?.items ?? []).map((i) => ({ ...i, gramsText: String(i.grams) }));
    itemQuery = '';
    dishDialog.showModal();
  }

  function addItem(f: Food) {
    items = [...items, { foodId: f.id, name: f.name, grams: 0, per100: f.per100, gramsText: String(f.portionG ?? 100) }];
    itemQuery = '';
  }

  async function saveDishForm(e: SubmitEvent) {
    e.preventDefault();
    // snapshot: nested $state proxies cannot be stored in IndexedDB
    const list = $state.snapshot(dishItems).filter((i) => i.grams > 0).map(({ gramsText: _g, ...i }) => i);
    if (!dishName.trim() || !list.length) return;
    const base = editDish ? $state.snapshot(editDish) : {};
    if (await act(() => saveDish(db, { ...base, name: dishName, items: list }))) dishDialog.close();
  }

  async function removeDish() {
    if (!editDish?.id || !confirm(`Удалить блюдо «${editDish.name}»? Записи в дневнике не изменятся.`)) return;
    const id = editDish.id;
    if (await act(() => deleteDish(db, id))) dishDialog.close();
  }

  // ---- CSV ----
  let csvErrors = $state<string[]>([]);

  async function importCsv(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const { foods: list, errors } = parseFoodCsv(await file.text());
    csvErrors = errors;
    if (!list.length) {
      notify('В файле не найдено ни одного продукта', 'error');
      return;
    }
    let res = { added: 0, skipped: 0 };
    if (await act(async () => (res = await importFoods(db, list))))
      notify(`Добавлено продуктов: ${res.added}${res.skipped ? `, пропущено (уже есть): ${res.skipped}` : ''}`);
  }

  const toggleFav = (f: Food) => act(() => updateFood(db, f.id!, { favorite: !f.favorite }));
  const toggleDishFav = (d: Dish) => act(() => saveDish(db, { ...$state.snapshot(d), favorite: !d.favorite }));
</script>

<div class="stack">
  <div class="seg sliding" style:--n={2} style:--i={tab === 'foods' ? 0 : 1}>
    <span class="plate" aria-hidden="true"></span>
    <button class:on={tab === 'foods'} onclick={() => (tab = 'foods')}>Продукты ({foods.current.length})</button>
    <button class:on={tab === 'dishes'} onclick={() => (tab = 'dishes')}>Блюда ({dishes.current.length})</button>
  </div>
  <div class="row">
    <input class="grow" bind:value={query} placeholder="Поиск" aria-label="Поиск" autocomplete="off" />
    <button class="primary" onclick={() => (tab === 'foods' ? openFood(null) : openDish(null))}>+</button>
  </div>

  <Pane active={tab === 'foods'}>
    <div class="card list">
      {#each shownFoods as f (f.id)}
        <div class="item">
          <button class="star" aria-label="Избранное" onclick={() => toggleFav(f)}><Icon name="star" size={20} filled={f.favorite} /></button>
          <button class="body" onclick={() => openFood(f)}>
            <span class="grow name">{f.name}</span>
            <span class="muted small num">{Math.round(f.per100.kcal)} · {fmt1(f.per100.p)}/{fmt1(f.per100.f)}/{fmt1(f.per100.c)}</span>
          </button>
        </div>
      {:else}
        <p class="muted small pad">{query ? 'Не найдено.' : 'Пусто. Продукты добавляются здесь или прямо при записи еды.'}</p>
      {/each}
    </div>
    <p class="muted small">Ккал · Б/Ж/У на 100 г. <Icon name="star" size={13} filled /> — избранное, показывается первым при добавлении еды.</p>

    <details class="card">
      <summary>Импорт из CSV</summary>
      <div class="stack csv">
        <p class="muted small">
          Строки вида <code>название; ккал; белки; жиры; углеводы</code> на 100 г, опционально <code>; порция; граммы</code>. Разделитель «;»,
          дробные через запятую или точку. Строка-заголовок пропускается, продукты с уже существующим названием тоже.
        </p>
        <input type="file" accept=".csv,text/csv,text/plain" onchange={importCsv} />
        {#each csvErrors as e (e)}<p class="small danger">{e}</p>{/each}
      </div>
    </details>
  </Pane>
  <Pane active={tab === 'dishes'}>
    <div class="card list">
      {#each shownDishes as d (d.id)}
        <div class="item">
          <button class="star" aria-label="Избранное" onclick={() => toggleDishFav(d)}><Icon name="star" size={20} filled={d.favorite} /></button>
          <button class="body" onclick={() => openDish(d)}>
            <span class="grow name">{d.name}</span>
            <span class="muted small num">{dishAsFood(d.items).total.kcal} ккал · {d.items.length} прод.</span>
          </button>
        </div>
      {:else}
        <p class="muted small pad">
          {query ? 'Не найдено.' : 'Блюд пока нет. Проще всего: записать приём пищи и нажать «Сохранить как блюдо-шаблон».'}
        </p>
      {/each}
    </div>
    <p class="muted small">Блюдо добавляется в дневник одним тапом, целиком. Граммовку потом можно поправить, значения пересчитаются.</p>
  </Pane>
</div>

<dialog class="sheet" bind:this={foodDialog}>
  <form class="stack" onsubmit={saveFood}>
    <h2>{editFood ? 'Продукт' : 'Новый продукт'}</h2>
    <FoodFields bind:draft />
    <div class="row spread">
      {#if editFood}<button type="button" class="link danger" onclick={removeFood}>Удалить</button>{:else}<span></span>{/if}
      <div class="row">
        <button type="button" onclick={() => foodDialog.close()}>Отмена</button>
        <button type="submit" class="primary" disabled={!foodOf(draft)}>Сохранить</button>
      </div>
    </div>
  </form>
</dialog>

<dialog class="sheet" bind:this={dishDialog}>
  <form class="stack" onsubmit={saveDishForm}>
    <h2>{editDish ? 'Блюдо' : 'Новое блюдо'}</h2>
    <input bind:value={dishName} placeholder="Название" aria-label="Название блюда" />
    {#each items as it, i (i)}
      <div class="row">
        <span class="grow name">{it.name}</span>
        <input class="g" bind:value={it.gramsText} inputmode="decimal" aria-label="Граммы {it.name}" /><span class="muted small">г</span>
        <button type="button" class="icon-btn" aria-label="Убрать" onclick={() => (items = items.filter((_, j) => j !== i))}><Icon name="close" size={18} /></button>
      </div>
    {/each}
    <input bind:value={itemQuery} placeholder="+ продукт из базы" aria-label="Добавить продукт" autocomplete="off" />
    {#each itemHits as f (f.id)}
      <button type="button" class="hit" onclick={() => addItem(f)}>{f.name}</button>
    {/each}
    <p class="num small muted">Итого: {dishTotal.grams} г, {dishTotal.total.kcal} ккал · Б {Math.round(dishTotal.total.p)} · Ж {Math.round(dishTotal.total.f)} · У {Math.round(dishTotal.total.c)}</p>
    <div class="row spread">
      {#if editDish}<button type="button" class="link danger" onclick={removeDish}>Удалить</button>{:else}<span></span>{/if}
      <div class="row">
        <button type="button" onclick={() => dishDialog.close()}>Отмена</button>
        <button type="submit" class="primary" disabled={!dishName.trim() || !dishItems.some((i) => i.grams > 0)}>Сохранить</button>
      </div>
    </div>
  </form>
</dialog>

<style>
  .list {
    padding: 0 8px;
  }

  .item {
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--border);
  }

  .item:last-child {
    border-bottom: none;
  }

  .star {
    background: none;
    border: none;
    padding: 0 10px;
    color: var(--accent);
    font-size: var(--fs-lg);
  }

  .body {
    flex: 1;
    min-width: 0;
    display: flex;
    gap: 8px;
    align-items: center;
    background: none;
    border: none;
    padding: 0 4px;
    text-align: left;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pad {
    padding: 12px 8px;
  }

  .csv {
    margin-top: 12px;
  }

  summary {
    cursor: pointer;
    min-height: 32px;
  }

  .g {
    width: 80px;
  }

  .hit {
    text-align: left;
  }
</style>
