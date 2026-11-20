<script lang="ts">
  import { untrack } from 'svelte';
  import SetEditor from './SetEditor.svelte';
  import ExercisePicker from './ExercisePicker.svelte';
  import RestBar from './RestBar.svelte';
  import PlateCalculator from './PlateCalculator.svelte';
  import { db } from '../../lib/app-db';
  import { act, days, gymSettings } from '../../lib/state.svelte';
  import { notify } from '../../lib/toast.svelte';
  import { useGym } from '../../lib/gym-data.svelte';
  import { startRest, stopRest, unlockSound } from '../../lib/rest.svelte';
  import { keepAwake } from '../../lib/wakelock';
  import { formatDayLong, relativeDayLabel } from '../../lib/logic/day';
  import {
    before,
    fmtKg,
    historyOf,
    lastPerformance,
    loadLabel,
    markRecords,
    newRecords,
    parseKgInput,
    prefillSet,
    progressionHint,
    RECORD_LABELS,
    recordsOf,
    restFor,
    roundKg,
    setText,
    stepFor,
    type SetKind,
    type WorkSet,
    type Workout,
  } from '../../lib/logic/gym';
  import {
    addItem,
    addSet,
    deleteSet,
    deleteWorkout,
    finishWorkout,
    moveItem,
    removeItem,
    updateSet,
    updateWorkout,
  } from '../../lib/repo/gym';

  let { workout, onclose }: { workout: Workout; onclose?: () => void } = $props();

  const gym = useGym();
  const isActive = $derived(workout.status === 'active');

  let cur = $state(0);
  const idx = $derived(Math.min(cur, Math.max(0, workout.items.length - 1)));
  const item = $derived(workout.items[idx]);
  const ex = $derived(item ? gym.exMap.get(item.exerciseId) : undefined);
  const earlier = $derived(before(gym.data.done, workout));
  // gym.data.done is newest first and before() keeps that order
  const prev = $derived(item ? lastPerformance(earlier, item.exerciseId) : null);
  const bodyKg = $derived(gym.body(workout.day));
  const step = $derived(ex ? stepFor(ex, gymSettings) : gymSettings.stepKg);
  const hint = $derived(item && ex && ex.load !== 'bodyweight' ? progressionHint(prev?.item.sets, item.target, step) : null);
  const marks = $derived(markRecords(workout, earlier, gym.exMap, gym.body));
  const workDone = $derived(item ? item.sets.filter((s) => s.kind === 'work').length : 0);

  // ---- next set inputs, prefilled from last time ----
  let kgText = $state('');
  let repsText = $state('');
  let kind = $state<SetKind>('work');
  let failure = $state(false);
  let rpe = $state('');
  let note = $state('');

  // prev is part of the key: data loads after the first render
  const prefillKey = $derived(`${workout.id}:${idx}:${item?.exerciseId}:${item?.sets.length}:${prev?.workoutId}`);
  $effect(() => {
    void prefillKey;
    untrack(() => {
      if (!item) return;
      const p = prefillSet(prev?.item.sets, item.sets, item.target);
      kgText = p.kg ? fmtKg(p.kg) : '';
      repsText = String(p.reps);
      kind = p.kind;
      rpe = '';
      note = '';
    });
  });

  const kg = $derived(parseKgInput(kgText));
  const reps = $derived(Number.parseInt(repsText, 10));
  const valid = $derived(kg != null && Number.isFinite(reps) && reps > 0 && reps < 1000);

  function bumpKg(d: number) {
    kgText = fmtKg(Math.max(0, roundKg((kg ?? 0) + d)));
  }
  function bumpReps(d: number) {
    repsText = String(Math.max(1, (Number.isFinite(reps) ? reps : 0) + d));
  }

  $effect(() => {
    if (isActive) return keepAwake();
  });

  async function done() {
    if (!item || !ex || !valid || workout.id == null) return;
    unlockSound();
    const s: WorkSet = {
      kg: ex.load === 'bodyweight' ? 0 : kg!,
      reps,
      kind,
      at: new Date().toISOString(),
      ...(failure ? { failure: true } : {}),
      ...(rpe ? { rpe: Number(rpe) } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    // same rule as markRecords: no records until the exercise has a history; other blocks
    // of the same exercise in this workout count as history too
    const hist = [
      ...historyOf(earlier, item.exerciseId),
      ...workout.items.filter((it, k) => k < idx && it.exerciseId === item.exerciseId).map((it) => ({ day: workout.day, sets: it.sets })),
    ];
    const kinds = hist.some((h) => h.sets.length)
      ? newRecords(s, recordsOf([...hist, { day: workout.day, sets: item.sets }], ex.load, gym.body), ex.load, bodyKg)
      : [];
    const id = workout.id;
    const i = idx;
    if (!(await act(() => addSet(db, id, i, s)))) return;
    if (kinds.length) notify(`Рекорд: ${kinds.map((k) => RECORD_LABELS[k]).join(', ')}`, 'info', 4000);
    if (isActive) startRest(restFor(ex, gymSettings));
  }

  // ---- set editing ----
  let editing = $state<{ i: number; j: number } | null>(null);

  async function saveSet(s: WorkSet | null) {
    if (!editing || workout.id == null) return;
    const { i, j } = editing;
    const id = workout.id;
    editing = null;
    await act(() => (s ? updateSet(db, id, i, j, s) : deleteSet(db, id, i, j)));
  }

  // ---- exercises ----
  let picking = $state(false);

  async function pick(exerciseId: number) {
    picking = false;
    if (workout.id == null) return;
    const id = workout.id;
    if (await act(() => addItem(db, id, exerciseId))) cur = workout.items.length; // the new one
  }

  async function removeCurrent() {
    if (!item || workout.id == null) return;
    if (item.sets.length && !confirm(`Убрать «${gym.name(item.exerciseId)}» вместе с подходами (${item.sets.length})?`)) return;
    const id = workout.id;
    const i = idx;
    if (await act(() => removeItem(db, id, i))) cur = Math.max(0, i - 1);
  }

  async function move(d: -1 | 1) {
    if (workout.id == null) return;
    const id = workout.id;
    const i = idx;
    if (await act(() => moveItem(db, id, i, d))) cur = i + d;
  }

  // ---- whole workout ----
  async function finish() {
    if (workout.id == null) return;
    const id = workout.id;
    const total = workout.items.reduce((a, i) => a + i.sets.length, 0);
    if (!total) {
      if (confirm('Ни одного подхода. Удалить пустую тренировку?')) {
        stopRest();
        await act(() => deleteWorkout(db, id));
      }
      return;
    }
    if (!confirm('Завершить тренировку? Упражнения без подходов уберутся.')) return;
    stopRest();
    await act(() => finishWorkout(db, id), 'Тренировка сохранена');
  }

  async function remove() {
    if (workout.id == null || !confirm(`Удалить тренировку за ${formatDayLong(workout.day)}? Это нельзя отменить.`)) return;
    const id = workout.id;
    if (isActive) stopRest();
    if (await act(() => deleteWorkout(db, id))) onclose?.();
  }

  let dayText = $state('');
  let noteText = $state('');
  $effect(() => {
    dayText = workout.day;
    noteText = workout.note ?? '';
  });

  async function saveMeta() {
    if (workout.id == null || !dayText || dayText > days.today) return;
    const id = workout.id;
    await act(() => updateWorkout(db, id, { day: dayText, note: noteText.trim() || undefined }), 'Сохранено');
  }

  const RPES = ['6', '7', '7.5', '8', '8.5', '9', '9.5', '10'];
</script>

<div class="stack">
  {#if !isActive}
    <div class="row spread">
      <h2>{formatDayLong(workout.day)}</h2>
      {#if onclose}<button class="link" onclick={onclose}>Закрыть</button>{/if}
    </div>
  {/if}

  {#if workout.items.length}
    <div class="ex-tabs" role="tablist">
      {#each workout.items as it, i (i)}
        {@const n = it.sets.filter((s) => s.kind === 'work').length}
        <button class="chip" class:on={i === idx} role="tab" aria-selected={i === idx} onclick={() => (cur = i)}>
          {gym.name(it.exerciseId)}
          <span class="cnt" class:full={it.target && n >= it.target.sets}>{n}{it.target ? `/${it.target.sets}` : ''}</span>
        </button>
      {/each}
      <button class="chip" onclick={() => (picking = true)}>+ Упражнение</button>
    </div>
  {:else}
    <div class="card stack">
      <p class="muted">Упражнений пока нет.</p>
      <button class="primary" onclick={() => (picking = true)}>+ Добавить упражнение</button>
    </div>
  {/if}

  {#if item && ex}
    <section class="card stack">
      <div class="row spread">
        <div class="grow">
          <h2>{ex.name}</h2>
          <span class="muted small">
            {loadLabel(ex.load)}{#if item.target}&nbsp;· цель {item.target.sets} × {item.target.repMin}–{item.target.repMax}{/if}
          </span>
        </div>
        <details class="menu">
          <summary aria-label="Действия с упражнением">⋯</summary>
          <div class="menu-body">
            <button disabled={idx === 0} onclick={() => move(-1)}>↑ Выше</button>
            <button disabled={idx === workout.items.length - 1} onclick={() => move(1)}>↓ Ниже</button>
            <button class="danger" onclick={removeCurrent}>Убрать из тренировки</button>
          </div>
        </details>
      </div>

      {#if prev}
        <p class="muted small">
          Прошлый раз, {relativeDayLabel(prev.day, days.today).toLowerCase()}: {prev.item.sets.map((s) => (s.kind === 'warmup' ? `(${setText(s, ex.load)})` : setText(s, ex.load))).join(', ')}
        </p>
      {:else}
        <p class="muted small">Первая запись этого упражнения.</p>
      {/if}

      {#if hint != null}
        <div class="hint row spread">
          <span class="small">В прошлый раз верх диапазона во всех рабочих подходах. Можно попробовать <b>{fmtKg(hint)} кг</b>.</span>
          <button class="link small" onclick={() => (kgText = fmtKg(hint!))}>Взять</button>
        </div>
      {/if}

      {#if item.sets.length}
        <ol class="sets">
          {#each item.sets as s, j (j)}
            {@const r = marks.get(`${idx}:${j}`)}
            <li>
              <button class="set" onclick={() => (editing = { i: idx, j })}>
                <span class="muted num">{j + 1}</span>
                <span class="grow num" class:warm={s.kind === 'warmup'}>
                  {setText(s, ex.load)}{#if s.kind === 'warmup'}&nbsp;<span class="tag">разминка</span>{/if}{#if s.failure}&nbsp;<span class="tag">отказ</span>{/if}{#if s.rpe}&nbsp;<span class="tag">RPE {String(s.rpe).replace('.', ',')}</span>{/if}
                </span>
                {#if r}<span class="pr" title={r.map((k) => RECORD_LABELS[k]).join(', ')}>★ рекорд</span>{/if}
              </button>
              {#if s.note}<span class="muted small note">{s.note}</span>{/if}
            </li>
          {/each}
        </ol>
      {/if}

      <div class="entry stack">
        {#if ex.load !== 'bodyweight'}
          <div class="stepper">
            <span class="muted small lab">{ex.load === 'bodyweight_plus' ? 'Доп. вес, кг' : 'Вес, кг'}</span>
            <button class="icon-btn" onclick={() => bumpKg(-step)} aria-label="Минус {fmtKg(step)} кг">−</button>
            <input class="big num" bind:value={kgText} inputmode="decimal" aria-label="Вес, кг" placeholder="0" />
            <button class="icon-btn" onclick={() => bumpKg(step)} aria-label="Плюс {fmtKg(step)} кг">+</button>
          </div>
        {/if}
        {#if ex.load === 'barbell'}<PlateCalculator target={kgText.trim() ? kg : null} />{/if}
        <div class="stepper">
          <span class="muted small lab">Повторы</span>
          <button class="icon-btn" onclick={() => bumpReps(-1)} aria-label="Минус повтор">−</button>
          <input class="big num" bind:value={repsText} inputmode="numeric" aria-label="Повторы" />
          <button class="icon-btn" onclick={() => bumpReps(1)} aria-label="Плюс повтор">+</button>
        </div>
        <div class="chips">
          <button class="chip" class:on={kind === 'work'} onclick={() => (kind = 'work')}>Рабочий</button>
          <button class="chip" class:on={kind === 'warmup'} onclick={() => (kind = 'warmup')}>Разминка</button>
          <button class="chip" class:on={failure} onclick={() => (failure = !failure)} aria-pressed={failure}>До отказа</button>
        </div>
        <details>
          <summary class="muted small">RPE и заметка</summary>
          <div class="stack more">
            <div class="chips">
              {#each RPES as v (v)}
                <button class="chip" class:on={rpe === v} onclick={() => (rpe = rpe === v ? '' : v)}>{v.replace('.', ',')}</button>
              {/each}
            </div>
            <input bind:value={note} placeholder="Заметка к подходу" aria-label="Заметка к подходу" />
          </div>
        </details>
        <button class="primary go" disabled={!valid} onclick={done}>
          Подход выполнен{#if item.target}&nbsp;({workDone + (kind === 'work' ? 1 : 0)} из {item.target.sets}){/if}
        </button>
        {#if bodyKg == null && ex.load === 'bodyweight_plus'}
          <p class="muted small">Вес тела неизвестен, поэтому 1ПМ и объём для этого упражнения не считаются. Запиши вес во вкладке «Вес».</p>
        {/if}
      </div>
    </section>

    {#if idx < workout.items.length - 1}
      <button onclick={() => (cur = idx + 1)}>Следующее: {gym.name(workout.items[idx + 1].exerciseId)} →</button>
    {/if}
  {/if}

  {#if isActive}
    <RestBar />
    <button class="finish" onclick={finish}>Завершить тренировку</button>
    <button class="link small danger" onclick={remove}>Удалить тренировку</button>
  {:else}
    <details class="card">
      <summary>Дата и заметка</summary>
      <div class="stack more">
        <input type="date" bind:value={dayText} max={days.today} aria-label="Дата" />
        <input bind:value={noteText} placeholder="Заметка к тренировке" aria-label="Заметка" />
        <div class="row spread">
          <button class="link danger" onclick={remove}>Удалить тренировку</button>
          <button class="primary" onclick={saveMeta}>Сохранить</button>
        </div>
      </div>
    </details>
  {/if}
</div>

{#if editing && workout.items[editing.i]}
  {@const it = workout.items[editing.i]}
  <SetEditor set={it.sets[editing.j]} load={gym.exMap.get(it.exerciseId)?.load ?? 'barbell'} onsave={saveSet} onclose={() => (editing = null)} />
{/if}
<ExercisePicker open={picking} exercises={gym.data.exercises} onpick={pick} onclose={() => (picking = false)} />

<style>
  .ex-tabs {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: none;
  }

  .ex-tabs .chip {
    flex: none;
    white-space: nowrap;
  }

  .cnt {
    margin-left: 6px;
    font-size: 0.8rem;
    color: var(--muted);
  }

  .cnt.full {
    color: var(--ok);
  }

  .hint {
    background: var(--surface-2);
    border-radius: 10px;
    padding: 8px 10px;
  }

  .sets {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .sets li {
    border-bottom: 1px solid var(--border);
  }

  .set {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    border-radius: 0;
    padding: 0 4px;
    min-height: 44px;
  }

  .note {
    display: block;
    padding: 0 4px 6px 28px;
  }

  .warm {
    color: var(--muted);
  }

  .tag {
    font-size: 0.75rem;
    color: var(--muted);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0 5px;
  }

  .pr {
    color: var(--ok);
    font-size: 0.85rem;
    white-space: nowrap;
  }

  .stepper {
    display: grid;
    grid-template-columns: 1fr var(--tap) 96px var(--tap);
    align-items: center;
    gap: 6px;
  }

  .stepper .icon-btn {
    font-size: 1.3rem;
  }

  .big {
    text-align: center;
    font-size: 1.3rem;
    padding: 0 4px;
  }

  .go {
    min-height: 56px;
    font-size: 1.05rem;
  }

  .more {
    margin-top: 10px;
  }

  summary {
    cursor: pointer;
    min-height: 32px;
  }

  .menu {
    position: relative;
  }

  .menu summary {
    list-style: none;
    min-width: var(--tap);
    min-height: var(--tap);
    display: grid;
    place-items: center;
    font-size: 1.3rem;
    color: var(--muted);
  }

  .menu summary::-webkit-details-marker {
    display: none;
  }

  .menu-body {
    position: absolute;
    right: 0;
    top: 100%;
    z-index: 5;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    min-width: 220px;
  }

  .menu-body button {
    text-align: left;
  }

  .finish {
    min-height: 52px;
  }
</style>
