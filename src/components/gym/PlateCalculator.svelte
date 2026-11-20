<script lang="ts">
  import { onMount } from 'svelte';
  import { getMeta, setMeta } from '../../lib/app-db';
  import { act } from '../../lib/state.svelte';
  import { fmtKg } from '../../lib/logic/gym';
  import { calculatePlates, DEFAULT_PLATES, PLATE_SIZES, type PlateConfig } from '../../lib/logic/plates';

  let { target }: { target: number | null } = $props();
  let barText = $state('20');
  let counts = $state(PLATE_SIZES.map(() => '0'));
  let loaded = $state(false);
  const number = (v: string) => v.trim() === '' ? NaN : Number(v.replace(',', '.'));
  const config = $derived({ barKg: number(barText), pairs: counts.map(number) });
  const result = $derived(target == null ? null : calculatePlates(target, config));
  const configValid = $derived(calculatePlates(0, config) !== null);

  onMount(async () => {
    try {
      const saved = await getMeta<PlateConfig>('plates');
      if (saved && calculatePlates(0, saved)) {
        barText = String(saved.barKg).replace('.', ',');
        counts = saved.pairs.map(String);
      } else {
        barText = String(DEFAULT_PLATES.barKg);
      }
    } catch { /* still usable without saved preferences */ }
    loaded = true;
  });
  async function save() {
    if (configValid) await act(() => setMeta('plates', $state.snapshot(config)), 'Настройки блинов сохранены');
  }
</script>

<details class="plates">
  <summary>Калькулятор блинов</summary>
  <div class="stack inner">
    <p class="muted small">Для штанги: укажи доступное число пар каждого блина. Вес равномерно распределяется по сторонам.</p>
    <label class="lbl"><span class="muted small">Вес грифа, кг</span><input bind:value={barText} inputmode="decimal" aria-label="Вес грифа, кг" /></label>
    <div class="plate-grid">
      {#each PLATE_SIZES as size, i}
        <label class="lbl"><span class="muted small">{fmtKg(size)} кг · пар</span><input bind:value={counts[i]} inputmode="numeric" aria-label="Пар блинов {fmtKg(size)} кг" /></label>
      {/each}
    </div>
    {#if !configValid}
      <p class="danger small">Гриф: 0–500 кг с шагом 0,25; количество каждого номинала: целое от 0 до 20.</p>
    {:else if target == null}
      <p class="muted small">Введи вес штанги, чтобы увидеть раскладку.</p>
    {:else if result}
      <div class="result">
        <b>{result.exact ? 'Точный вес' : 'Ближайший вес'}: {fmtKg(result.total)} кг</b>
        <p class="small">На каждую сторону: {result.pairs.some((n) => n) ? result.pairs.map((n, i) => n ? `${n} × ${fmtKg(PLATE_SIZES[i])} кг` : '').filter(Boolean).join(' + ') : 'без блинов'}.</p>
        {#if !result.exact}<p class="muted small">Выбранный вес подхода не меняется.</p>{/if}
      </div>
    {:else}
      <p class="muted small">Введите вес от 0 до 500 кг с шагом 0,25 кг.</p>
    {/if}
    <button disabled={!loaded || !configValid} onclick={save}>Сохранить гриф и блины</button>
  </div>
</details>

<style>
  .plates { border-top: 1px solid var(--border); padding-top: 12px; }
  summary { cursor: pointer; color: var(--accent); min-height: 44px; display: flex; align-items: center; }
  summary::before { content: '▸'; margin-right: 8px; }
  details[open] summary::before { content: '▾'; }
  .inner { padding-top: 4px; }
  .plate-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .result { background: var(--surface-2); padding: 12px; border-radius: 8px; display: grid; gap: 4px; }
</style>
