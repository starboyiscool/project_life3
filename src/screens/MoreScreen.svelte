<script lang="ts">
  import StudyScreen from './StudyScreen.svelte';
  import HabitsScreen from './HabitsScreen.svelte';
  import ReviewScreen from './ReviewScreen.svelte';
  import DoneScreen from './DoneScreen.svelte';
  import DataScreen from './DataScreen.svelte';
  import SettingsScreen from './SettingsScreen.svelte';
  import Pane from '../components/Pane.svelte';
  import Icon from '../components/Icon.svelte';
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

<div class="stack">
  {#if nav.more === 'menu'}
    <h1>Ещё</h1>
    {#each pages as p (p.id)}
      <button class="card item" onclick={() => go('more', p.id)}>
        <span>{p.label}</span>
        <span class="muted small">{p.hint}</span>
      </button>
    {/each}
  {:else}
    <div class="row">
      <button class="icon-btn" aria-label="Назад" onclick={() => go('more')}><Icon name="back" /></button>
      <h1>{pages.find((p) => p.id === nav.more)?.label}</h1>
    </div>
  {/if}
  <Pane active={nav.more === 'study'}><StudyScreen /></Pane>
  <Pane active={nav.more === 'review'}><ReviewScreen /></Pane>
  <Pane active={nav.more === 'habits'}><HabitsScreen /></Pane>
  <Pane active={nav.more === 'done'}><DoneScreen /></Pane>
  <Pane active={nav.more === 'data'}><DataScreen /></Pane>
  <Pane active={nav.more === 'settings'}><SettingsScreen /></Pane>
</div>

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
