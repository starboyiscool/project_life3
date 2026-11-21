<script lang="ts">
  import { db } from '../lib/app-db';
  import { act, days, live } from '../lib/state.svelte';
  import { listWeights, saveWeight, type WeightEntry } from '../lib/repo/weights';
  import { formatKg, formatSigned, parseKg, weeklyTrend } from '../lib/logic/weight';
  import { relativeDayLabel } from '../lib/logic/day';
  import Icon from './Icon.svelte';

  let { compact = false }: { compact?: boolean } = $props();

  const weights = live(() => () => listWeights(db), [] as WeightEntry[], 'weights');
  const todayEntry = $derived(weights.current.find((w) => w.day === days.today));
  const last = $derived(weights.current.at(-1));
  const trend = $derived(weeklyTrend(weights.current));

  let editing = $state(false);
  let text = $state('');
  let input = $state<HTMLInputElement>();

  const parsed = $derived(parseKg(text));

  function startEdit() {
    text = todayEntry ? formatKg(todayEntry.kg) : '';
    editing = true;
    queueMicrotask(() => input?.focus());
  }

  async function save(e: SubmitEvent) {
    e.preventDefault();
    if (parsed == null) return;
    const kg = parsed;
    if (await act(() => saveWeight(db, days.today, kg))) {
      editing = false;
      text = '';
    }
  }
</script>

{#if weights.loaded}
  {#if todayEntry && !editing}
    <div class="row spread">
      <div>
        <span class="big">{formatKg(todayEntry.kg)}</span> <span class="muted">кг</span>
        {#if trend !== null}<span class="muted small">&nbsp;· тренд {formatSigned(trend)} кг/нед</span>{/if}
      </div>
      <button class="link" onclick={startEdit}>Изменить</button>
    </div>
  {:else if compact && !editing}
    <!-- weighed only at the gym: on Today show the last value and a one-tap entry -->
    <div class="row spread">
      <div>
        {#if last}
          <span class="big">{formatKg(last.kg)}</span> <span class="muted">кг</span>
          <span class="muted small">&nbsp;· {relativeDayLabel(last.day, days.today).toLowerCase()}{#if trend !== null}, тренд {formatSigned(trend)} кг/нед{/if}</span>
        {:else}
          <span class="muted small">Замеров пока нет</span>
        {/if}
      </div>
      <button class="link" onclick={startEdit}>+ Записать</button>
    </div>
  {:else}
    <form class="row" onsubmit={save}>
      <input
        bind:this={input}
        bind:value={text}
        inputmode="decimal"
        placeholder={last ? `прошлый: ${formatKg(last.kg)}` : 'вес, кг'}
        aria-label="Вес, кг"
        autocomplete="off"
      />
      <button type="submit" class="primary" disabled={parsed == null}>Сохранить</button>
      {#if editing}<button type="button" class="icon-btn" aria-label="Отмена" onclick={() => (editing = false)}><Icon name="close" size={18} /></button>{/if}
    </form>
    {#if !compact && text && parsed == null}<p class="muted small">Введите вес в кг, например 71,4</p>{/if}
  {/if}
{/if}

<style>
  .big {
    font-size: var(--fs-xl);
    font-weight: 600;
  }

  form input {
    flex: 1;
  }
</style>
