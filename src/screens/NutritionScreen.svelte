<script lang="ts">
  import FoodDay from '../components/food/FoodDay.svelte';
  import FoodWeek from '../components/food/FoodWeek.svelte';
  import FoodCalc from '../components/food/FoodCalc.svelte';
  import FoodBase from '../components/food/FoodBase.svelte';
  import Pane from '../components/Pane.svelte';
  import { nav, go, type FoodPage } from '../lib/nav.svelte';

  const pages: { id: FoodPage; label: string }[] = [
    { id: 'day', label: 'День' },
    { id: 'week', label: 'Неделя' },
    { id: 'calc', label: 'Расчёт' },
    { id: 'base', label: 'База' },
  ];
</script>

<div class="stack">
  <h1>Питание</h1>
  <div class="seg sliding" style:--n={pages.length} style:--i={pages.findIndex((p) => p.id === nav.food)}>
    <span class="plate" aria-hidden="true"></span>
    {#each pages as p (p.id)}
      <button class:on={nav.food === p.id} onclick={() => go('food', p.id)}>{p.label}</button>
    {/each}
  </div>
  <Pane active={nav.food === 'day'}><FoodDay /></Pane>
  <Pane active={nav.food === 'week'}><FoodWeek /></Pane>
  <Pane active={nav.food === 'calc'}><FoodCalc /></Pane>
  <Pane active={nav.food === 'base'}><FoodBase /></Pane>
</div>
