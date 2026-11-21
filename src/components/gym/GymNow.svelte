<script lang="ts">
  import WorkoutView from './WorkoutView.svelte';
  import WorkoutSummary from './WorkoutSummary.svelte';
  import WeightInput from '../WeightInput.svelte';
  import { db } from '../../lib/app-db';
  import { act, days, gymSettings, saveGymSettings } from '../../lib/state.svelte';
  import { useGym } from '../../lib/gym-data.svelte';
  import { go } from '../../lib/nav.svelte';
  import { relativeDayLabel } from '../../lib/logic/day';
  import { nextWorkout, type WorkoutTemplate } from '../../lib/logic/gym';
  import { startWorkout } from '../../lib/repo/gym';

  const gym = useGym();
  const next = $derived(nextWorkout(gym.data.done, gym.data.templates, gymSettings.intervalDays, days.today));
  const doneToday = $derived(gym.data.done.filter((w) => w.day === days.today));
  const hasWeightToday = $derived(gym.data.weights.some((w) => w.day === days.today));

  function start(t: WorkoutTemplate | null) {
    act(() => startWorkout(db, days.today, t));
  }

  const num = (v: string, min: number, max: number) => {
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  };

  function setNum(key: 'stepKg' | 'restCompoundSec' | 'restIsolationSec' | 'intervalDays', v: string, min: number, max: number, scale = 1) {
    const n = num(v, min, max);
    if (n == null) return;
    const value = key === 'intervalDays' ? Math.round(n) : Math.round(n * scale * 100) / 100;
    act(() => saveGymSettings({ [key]: value }));
  }
</script>

{#if !gym.loaded}
  <!-- neutral placeholder of fixed height instead of a blinking "…" -->
  <div class="card placeholder" role="status" aria-label="Загрузка"></div>
{:else if gym.data.active}
  <WorkoutView workout={gym.data.active} />
{:else}
  <div class="stack">
    {#each doneToday as w (w.id)}
      <section class="card stack">
        <h2 class="section-title">Сегодня, тренировка завершена</h2>
        <WorkoutSummary workout={w} {gym} />
        {#if !hasWeightToday}
          <p class="small">Весы рядом: запиши вес после тренировки.</p>
          <WeightInput compact />
        {/if}
      </section>
    {/each}

    <section class="card stack">
      <h2 class="section-title">
        {#if next.due === days.today}По графику: сегодня{:else}Следующая по графику: {relativeDayLabel(next.due, days.today).toLowerCase()}{/if}
      </h2>
      {#if next.template}
        {@const t = next.template}
        <div class="row">
          <b>{t.name}</b>{#if t.suggestion}<span class="tag">предложение</span>{/if}
        </div>
        <ul class="muted small plan">
          {#each t.items as i, k (k)}<li>{gym.name(i.exerciseId)}: {i.sets} × {i.repMin}–{i.repMax}</li>{/each}
        </ul>
        <button class="primary" onclick={() => start(t)}>Начать «{t.name}»</button>
      {:else}
        <p class="muted small">Шаблонов нет. Можно начать пустую тренировку и добавлять упражнения по ходу.</p>
      {/if}
      <div class="row wrap">
        {#each gym.data.templates.filter((t) => t.id !== next.template?.id) as t (t.id)}
          <button onclick={() => start(t)}>{t.name}</button>
        {/each}
        <button onclick={() => start(null)}>Пустая тренировка</button>
      </div>
      <p class="muted small">
        График «раз в {gymSettings.intervalDays} дн.» считается от последней тренировки: пропуск сдвигает цикл, а не ломает его.
      </p>
    </section>

    <button class="card nav-item" onclick={() => go('gym', 'library')}>
      <span>Упражнения и шаблоны</span>
      <span class="muted small">{gym.data.exercises.filter((e) => !e.archived).length} упражнений, {gym.data.templates.length} шабл.</span>
    </button>

    <details class="card">
      <summary>Настройки зала</summary>
      <div class="stack opts">
        <label class="lbl"><span class="muted small">Шаг веса, кг</span>
          <input value={String(gymSettings.stepKg).replace('.', ',')} inputmode="decimal" onchange={(e) => setNum('stepKg', e.currentTarget.value, 0.25, 50)} /></label>
        <label class="lbl"><span class="muted small">Отдых после базовых, мин</span>
          <input value={String(gymSettings.restCompoundSec / 60).replace('.', ',')} inputmode="decimal" onchange={(e) => setNum('restCompoundSec', e.currentTarget.value, 0.25, 15, 60)} /></label>
        <label class="lbl"><span class="muted small">Отдых после изолирующих, мин</span>
          <input value={String(gymSettings.restIsolationSec / 60).replace('.', ',')} inputmode="decimal" onchange={(e) => setNum('restIsolationSec', e.currentTarget.value, 0.25, 15, 60)} /></label>
        <label class="lbl"><span class="muted small">Тренировка раз в N дней</span>
          <input value={String(gymSettings.intervalDays)} inputmode="numeric" onchange={(e) => setNum('intervalDays', e.currentTarget.value, 1, 7)} /></label>
        <p class="muted small">Для отдельного упражнения шаг и отдых можно задать в его карточке.</p>
      </div>
    </details>
  </div>
{/if}

<style>
  .placeholder {
    min-height: 260px;
  }

  .tag {
    font-size: var(--fs-xs);
    color: var(--muted);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0 5px;
  }

  .plan {
    margin: 0;
    padding-left: 18px;
  }

  .wrap {
    flex-wrap: wrap;
  }

  .nav-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    height: auto;
    min-height: 64px;
    justify-content: center;
    gap: 2px;
  }

  summary {
    cursor: pointer;
    min-height: 32px;
    color: var(--muted);
  }

  .opts {
    margin-top: 12px;
  }
</style>
