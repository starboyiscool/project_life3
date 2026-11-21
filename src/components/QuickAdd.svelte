<script lang="ts">
  import Icon from './Icon.svelte';
  import { CATEGORIES, type Category } from '../lib/logic/tasks';
  import { addTask } from '../lib/repo/tasks';
  import { db } from '../lib/app-db';
  import { act } from '../lib/state.svelte';
  import type { Day } from '../lib/logic/day';

  let { day, placeholder = 'Добавить задачу…', initialCategory = 'other' }: { day: Day | ''; placeholder?: string; initialCategory?: Category } = $props();

  let title = $state('');
  let isMit = $state(false);
  let category = $state<Category>('other');
  $effect(() => { category = initialCategory; });
  let showCats = $state(false);
  let input: HTMLInputElement;

  async function add(e: SubmitEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    const ok = await act(() => addTask(db, day, { title: t, isMit, category }));
    if (ok) {
      title = '';
      isMit = false;
      input.focus();
    }
  }
</script>

<form class="stack qa" onsubmit={add}>
  <div class="row">
    <button
      type="button"
      class="icon-btn star"
      class:on={isMit}
      aria-pressed={isMit}
      aria-label="Приоритетная (MIT)"
      onclick={() => (isMit = !isMit)}><Icon name="star" size={18} filled={isMit} /></button
    >
    <input bind:this={input} bind:value={title} {placeholder} enterkeyhint="done" autocomplete="off" />
    <button type="submit" class="primary icon-btn" aria-label="Добавить" disabled={!title.trim()}>+</button>
  </div>
  {#if title || showCats}
    <div class="chips">
      {#each CATEGORIES as c (c.id)}
        <button type="button" class="chip" class:on={category === c.id} onclick={() => (category = c.id)}>{c.label}</button>
      {/each}
    </div>
  {:else}
    <button type="button" class="link small cat-toggle" onclick={() => (showCats = true)}>
      Категория: {CATEGORIES.find((c) => c.id === category)?.label}
    </button>
  {/if}
</form>

<style>
  .star {
    color: var(--muted);
    font-size: var(--fs-lg);
  }

  .star.on {
    color: var(--accent);
    border-color: var(--accent);
  }

  .primary.icon-btn {
    font-size: var(--fs-xl);
  }

  .qa {
    gap: 8px;
  }

  .cat-toggle {
    align-self: flex-start;
    min-height: 32px;
    padding: 0;
  }
</style>
