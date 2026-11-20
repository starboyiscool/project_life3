<script lang="ts">
  import StudyScreen from './StudyScreen.svelte';
  import HabitsScreen from './HabitsScreen.svelte';
  import ReviewScreen from './ReviewScreen.svelte';
  import DoneScreen from './DoneScreen.svelte';
  import DataScreen from './DataScreen.svelte';
  import SettingsScreen from './SettingsScreen.svelte';
  import { nav, go, type MorePage } from '../lib/nav.svelte';

  const pages: { id: Exclude<MorePage, 'menu'>; label: string; hint: string }[] = [
    { id: 'study', label: 'Учёба и задолженности', hint: 'Предметы, работы и сроки' },
    { id: 'review', label: 'Обзор недели', hint: 'Итоги, цели на следующую неделю' },
    { id: 'habits', label: 'Привычки', hint: 'Список, серии, отметки за прошлые дни' },
    { id: 'done', label: 'Выполнено', hint: 'Лог задач по дням, серия MIT' },
    { id: 'data', label: 'Данные', hint: 'Экспорт, импорт, снапшоты' },
    { id: 'settings', label: 'Настройки', hint: 'Граница дня, приёмы пищи' },
  ];
</script>

{#if nav.more === 'menu'}
  <div class="stack">
    <h1>Ещё</h1>
    {#each pages as p (p.id)}
      <button class="card item" onclick={() => go('more', p.id)}>
        <span>{p.label}</span>
        <span class="muted small">{p.hint}</span>
      </button>
    {/each}
  </div>
{:else}
  <div class="stack">
    <div class="row">
      <button class="icon-btn" aria-label="Назад" onclick={() => go('more')}>←</button>
      <h1>{pages.find((p) => p.id === nav.more)?.label}</h1>
    </div>
    {#if nav.more === 'study'}<StudyScreen />
    {:else if nav.more === 'review'}<ReviewScreen />
    {:else if nav.more === 'habits'}<HabitsScreen />
    {:else if nav.more === 'done'}<DoneScreen />
    {:else if nav.more === 'data'}<DataScreen />
    {:else}<SettingsScreen />{/if}
  </div>
{/if}

<style>
  .item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    height: auto;
    min-height: 64px;
    justify-content: center;
    gap: 2px;
  }
</style>
