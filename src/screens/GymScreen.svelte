<script lang="ts">
  import GymNow from '../components/gym/GymNow.svelte';
  import GymHistory from '../components/gym/GymHistory.svelte';
  import GymProgress from '../components/gym/GymProgress.svelte';
  import GymLibrary from '../components/gym/GymLibrary.svelte';
  import WeightScreen from './WeightScreen.svelte';
  import { nav, go, type GymPage } from '../lib/nav.svelte';

  const pages: { id: GymPage; label: string }[] = [
    { id: 'now', label: 'Сейчас' },
    { id: 'history', label: 'История' },
    { id: 'progress', label: 'Прогресс' },
    { id: 'weight', label: 'Вес' },
  ];
</script>

<div class="stack">
  {#if nav.gym === 'library'}
    <div class="row">
      <button class="icon-btn" aria-label="Назад" onclick={() => go('gym', 'now')}>←</button>
      <h1>Упражнения и шаблоны</h1>
    </div>
    <GymLibrary />
  {:else}
    <h1>Зал</h1>
    <div class="seg">
      {#each pages as p (p.id)}
        <button class:on={nav.gym === p.id} onclick={() => go('gym', p.id)}>{p.label}</button>
      {/each}
    </div>
    {#if nav.gym === 'now'}<GymNow />
    {:else if nav.gym === 'history'}<GymHistory />
    {:else if nav.gym === 'progress'}<GymProgress />
    {:else}<WeightScreen />{/if}
  {/if}
</div>
