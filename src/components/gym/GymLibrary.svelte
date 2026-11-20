<script lang="ts">
  import ExerciseEditor from './ExerciseEditor.svelte';
  import TemplateEditor from './TemplateEditor.svelte';
  import { db } from '../../lib/app-db';
  import { act } from '../../lib/state.svelte';
  import { useGym } from '../../lib/gym-data.svelte';
  import { groupLabel, loadLabel, MUSCLE_GROUPS, type Exercise, type WorkoutTemplate } from '../../lib/logic/gym';
  import { saveExercise } from '../../lib/repo/gym';

  const gym = useGym();

  let seg = $state<'ex' | 'tpl'>('tpl');
  let editEx = $state<Exercise | null>(null);
  let editTpl = $state<WorkoutTemplate | null>(null);

  const active = $derived(gym.data.exercises.filter((e) => !e.archived));
  const archived = $derived(gym.data.exercises.filter((e) => e.archived));
  const groups = $derived(MUSCLE_GROUPS.map((g) => ({ g: g.id, list: active.filter((e) => e.primary === g.id) })).filter((x) => x.list.length));

  const newEx = (): Exercise => ({ name: '', primary: 'chest', secondary: [], load: 'barbell', compound: true, preset: false, createdAt: new Date().toISOString() });
  const newTpl = (): WorkoutTemplate => ({ name: '', items: [], suggestion: false, order: 0, createdAt: new Date().toISOString() });
</script>

<div class="stack">
  <div class="seg">
    <button class:on={seg === 'tpl'} onclick={() => (seg = 'tpl')}>Шаблоны</button>
    <button class:on={seg === 'ex'} onclick={() => (seg = 'ex')}>Упражнения</button>
  </div>

  {#if seg === 'tpl'}
    {#each gym.data.templates as t (t.id)}
      <button class="card item" onclick={() => (editTpl = $state.snapshot(t))}>
        <span class="row"><b>{t.name}</b>{#if t.suggestion}<span class="tag">предложение</span>{/if}</span>
        <span class="muted small">{t.items.map((i) => `${gym.name(i.exerciseId)} ${i.sets}×${i.repMin}–${i.repMax}`).join(' · ') || 'пусто'}</span>
      </button>
    {/each}
    {#if gym.data.templates.some((t) => t.suggestion)}
      <p class="muted small">«Предложение» — шаблон, который составило приложение, без весов. Поменяй под себя: после сохранения пометка исчезнет.</p>
    {/if}
    <button onclick={() => (editTpl = newTpl())}>+ Новый шаблон</button>
    <p class="muted small">Шаблоны чередуются по порядку в списке: следующая тренировка берёт шаблон после последнего выполненного.</p>
  {:else}
    {#each groups as x (x.g)}
      <section class="card list">
        <h2 class="section-title">{groupLabel(x.g)}</h2>
        {#each x.list as e (e.id)}
          <button class="row-btn" onclick={() => (editEx = { ...$state.snapshot(e) })}>
            <span class="grow">{e.name}</span>
            <span class="muted small">{loadLabel(e.load)}</span>
          </button>
        {/each}
      </section>
    {/each}
    <button onclick={() => (editEx = newEx())}>+ Новое упражнение</button>
    {#if archived.length}
      <details class="card">
        <summary class="muted">Архив ({archived.length})</summary>
        {#each archived as e (e.id)}
          <div class="row spread row-btn">
            <span>{e.name}</span>
            <button class="link small" onclick={() => act(() => saveExercise(db, { ...$state.snapshot(e), archived: false }), 'Возвращено')}>Вернуть</button>
          </div>
        {/each}
      </details>
    {/if}
  {/if}
</div>

<ExerciseEditor exercise={editEx} onclose={() => (editEx = null)} />
<TemplateEditor template={editTpl} exercises={gym.data.exercises} onclose={() => (editTpl = null)} />

<style>
  .item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    height: auto;
    gap: 4px;
    padding: 12px 14px;
  }

  .tag {
    font-size: 0.75rem;
    color: var(--muted);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0 5px;
  }

  .list {
    display: flex;
    flex-direction: column;
    padding: 12px 14px 4px;
  }

  .row-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: left;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    border-radius: 0;
    padding: 0 2px;
    min-height: 48px;
  }

  .row-btn:last-child {
    border-bottom: none;
  }

  summary {
    cursor: pointer;
    min-height: 32px;
  }
</style>
