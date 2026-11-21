<script lang="ts">
  import Icon from './Icon.svelte';
  import { db } from '../lib/app-db';
  import { act, live } from '../lib/state.svelte';
  import { ensureRecurring, listRecurring, saveRecurring } from '../lib/repo/tasks';
  import { CATEGORIES, categoryLabel, type Category, type RecurringTask } from '../lib/logic/tasks';
  import { describeRule, type RepeatRule } from '../lib/logic/recurrence';
  import { WEEKDAYS_SHORT } from '../lib/logic/day';

  let { startDay }: { startDay: string } = $props();
  let firstDay = $state('');
  $effect(() => { firstDay = startDay; });
  let timeStart = $state('');
  const rules = live(() => () => listRecurring(db), [] as RecurringTask[]);

  let title = $state('');
  let isMit = $state(false);
  let category = $state<Category>('other');
  let kind = $state<RepeatRule['type']>('daily');
  let weekdays = $state<number[]>([]);
  let every = $state(2);

  const rule = $derived<RepeatRule>(
    kind === 'daily' ? { type: 'daily' } : kind === 'weekdays' ? { type: 'weekdays', days: [...weekdays] } : { type: 'interval', every },
  );
  const valid = $derived(title.trim() && (kind !== 'weekdays' || weekdays.length > 0) && (kind !== 'interval' || every >= 2));

  function toggleDay(d: number) {
    weekdays = weekdays.includes(d) ? weekdays.filter((x) => x !== d) : [...weekdays, d];
  }

  async function add(e: SubmitEvent) {
    e.preventDefault();
    if (!valid) return;
    const r: RecurringTask = {
      title: title.trim(),
      isMit,
      category,
      rule,
      startDay: firstDay,
      timeStart: timeStart || undefined,
      active: true,
      createdAt: new Date().toISOString(),
    };
    if (await act(async () => { await saveRecurring(db, r); await ensureRecurring(db, firstDay); }, 'Повтор добавлен')) {
      title = '';
      isMit = false;
    }
  }

  function toggleActive(r: RecurringTask) {
    act(() => saveRecurring(db, { ...$state.snapshot(r), active: !r.active }));
  }
</script>

<section class="card">
  {#if rules.loaded && rules.current.length === 0}<p class="muted">Повторяющихся задач нет.</p>{/if}
  {#each rules.current as r (r.id)}
    <div class="row spread item" class:off={!r.active}>
      <div class="grow">
        <div>{#if r.isMit}<span class="star"><Icon name="star" size={14} filled label="приоритет" /></span>{/if}{r.title}</div>
        <div class="muted small">{describeRule(r.rule)} · {categoryLabel(r.category)}</div>
      </div>
      <button class="small" onclick={() => toggleActive(r)}>{r.active ? 'Выключить' : 'Включить'}</button>
    </div>
  {/each}
</section>

<form class="card stack" onsubmit={add}>
  <h2 class="section-title">Новый повтор</h2>
  <input bind:value={title} placeholder="Название" aria-label="Название" />
  <div class="chips">
    <button type="button" class="chip" class:on={isMit} onclick={() => (isMit = !isMit)}><Icon name="star" size={13} filled /> MIT</button>
    {#each CATEGORIES as c (c.id)}
      <button type="button" class="chip" class:on={category === c.id} onclick={() => (category = c.id)}>{c.label}</button>
    {/each}
  </div>
  <div class="seg">
    <button type="button" class:on={kind === 'daily'} onclick={() => (kind = 'daily')}>Каждый день</button>
    <button type="button" class:on={kind === 'weekdays'} onclick={() => (kind = 'weekdays')}>Дни недели</button>
    <button type="button" class:on={kind === 'interval'} onclick={() => (kind = 'interval')}>Раз в N дней</button>
  </div>
  {#if kind === 'weekdays'}
    <div class="chips">
      {#each WEEKDAYS_SHORT as w, i (w)}
        <button type="button" class="chip" class:on={weekdays.includes(i)} onclick={() => toggleDay(i)}>{w}</button>
      {/each}
    </div>
  {:else if kind === 'interval'}
    <label class="row"><span class="muted">Каждые</span><input type="number" min="2" max="30" bind:value={every} class="n" /><span class="muted">дн.</span></label>
  {/if}
  <label class="lbl"><span>Начало повтора</span><input type="date" bind:value={firstDay} required /></label>
  <label class="lbl"><span>Время (необязательно)</span><input type="time" bind:value={timeStart} /></label>
  <button type="submit" class="primary" disabled={!valid}>Добавить</button>
  <p class="muted small">Повторы видны в календаре и создаются в плане при открытии дня. Выключение не удаляет уже созданные задачи.</p>
</form>

<style>
  .item {
    min-height: 56px;
    border-bottom: 1px solid var(--border);
  }

  .off {
    opacity: 0.5;
  }

  .star {
    color: var(--accent);
    margin-right: 6px;
  }

  .n {
    width: 80px;
  }

  .seg button {
    font-size: var(--fs-sm);
  }
</style>
