<script lang="ts">
  import { act, nutritionSettings, saveNutritionSettings, saveSettings, settings } from '../lib/state.svelte';
  import { setTheme } from '../lib/theme.svelte';
  import Icon from '../components/Icon.svelte';
  import { TZ } from '../lib/logic/day';
  import { DEFAULT_MEALS } from '../lib/logic/nutrition';

  const HOURS = [0, 1, 2, 3, 4, 5, 6];

  let newMeal = $state('');

  function setMeals(meals: string[]) {
    act(() => saveNutritionSettings({ meals }), 'Сохранено');
  }

  function move(i: number, d: -1 | 1) {
    const m = [...nutritionSettings.meals];
    [m[i], m[i + d]] = [m[i + d], m[i]];
    setMeals(m);
  }

  function addMeal(e: SubmitEvent) {
    e.preventDefault();
    const name = newMeal.trim();
    if (!name || nutritionSettings.meals.includes(name)) return;
    setMeals([...nutritionSettings.meals, name]);
    newMeal = '';
  }
</script>

<div class="stack">
  <section class="card stack">
    <label class="lbl"><span>Тема оформления</span>
      <select value={settings.theme} onchange={(e) => setTheme(e.currentTarget.value as 'light' | 'dark' | 'system', 'Сохранено')}>
        <option value="system">Как в системе</option><option value="light">Светлая</option><option value="dark">Тёмная</option>
      </select>
    </label>
  </section>
  <section class="card stack">
    <h2>Текущий семестр</h2>
    <label class="lbl"><span>Номер семестра</span><input type="number" min="1" max="30" value={settings.semesterNumber ?? ''} onchange={(e) => act(() => saveSettings({semesterNumber: e.currentTarget.value ? Number(e.currentTarget.value) : undefined}), 'Сохранено')} /></label>
    <label class="lbl"><span>Первый день семестра</span><input type="date" value={settings.semesterStart ?? ''} onchange={(e) => act(() => saveSettings({semesterStart: e.currentTarget.value || undefined}), 'Сохранено')} /></label>
    <p class="muted small">Неделя начинается с указанного дня и длится семь дней. Привязка работ к календарю действует только для предметов с этим номером семестра.</p>
  </section>
  <section class="card stack">
    <label class="stack">
      <span>День заканчивается в</span>
      <select
        value={String(settings.dayStartHour)}
        onchange={(e) => act(() => saveSettings({ dayStartHour: Number(e.currentTarget.value) }), 'Сохранено')}
      >
        {#each HOURS as h (h)}<option value={String(h)}>{String(h).padStart(2, '0')}:00</option>{/each}
      </select>
      <span class="muted small">Всё, что отмечено до этого времени ночью, относится к предыдущему дню.</span>
    </label>
    <p class="muted small">Часовой пояс: {TZ}</p>
  </section>

  <section class="card stack">
    <span>Приёмы пищи</span>
    {#each nutritionSettings.meals as m, i (m)}
      <div class="row">
        <span class="grow">{m}</span>
        <button class="icon-btn" aria-label="Выше" disabled={i === 0} onclick={() => move(i, -1)}><Icon name="up" size={18} /></button>
        <button class="icon-btn" aria-label="Ниже" disabled={i === nutritionSettings.meals.length - 1} onclick={() => move(i, 1)}><Icon name="down" size={18} /></button>
        <button
          class="icon-btn"
          aria-label="Убрать"
          disabled={nutritionSettings.meals.length <= 1}
          onclick={() => confirm(`Убрать «${m}» из списка? Записи в дневнике останутся.`) && setMeals(nutritionSettings.meals.filter((x) => x !== m))}
          ><Icon name="close" size={18} /></button
        >
      </div>
    {/each}
    <form class="row" onsubmit={addMeal}>
      <input bind:value={newMeal} placeholder="Новый приём, например «После зала»" aria-label="Новый приём пищи" />
      <button type="submit" disabled={!newMeal.trim()}>+</button>
    </form>
    {#if nutritionSettings.meals.join() !== DEFAULT_MEALS.join()}
      <button class="link small reset" onclick={() => setMeals([...DEFAULT_MEALS])}>Вернуть стандартные</button>
    {/if}
  </section>
</div>

<style>
  .reset {
    align-self: flex-start;
    padding: 0;
    min-height: 32px;
  }
</style>
