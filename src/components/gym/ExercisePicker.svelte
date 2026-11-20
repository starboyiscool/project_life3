<script lang="ts">
  import { groupLabel, MUSCLE_GROUPS, type Exercise } from '../../lib/logic/gym';
  import { go } from '../../lib/nav.svelte';

  let { open, exercises, onpick, onclose }: { open: boolean; exercises: Exercise[]; onpick: (id: number) => void; onclose: () => void } = $props();

  let dialog: HTMLDialogElement;
  let query = $state('');

  $effect(() => {
    if (open && !dialog.open) {
      query = '';
      dialog.showModal();
    } else if (!open && dialog?.open) dialog.close();
  });

  const norm = (s: string) => s.toLowerCase().replaceAll('ё', 'е');
  const shown = $derived(exercises.filter((e) => !e.archived && norm(e.name).includes(norm(query.trim()))));
  const groups = $derived(MUSCLE_GROUPS.map((g) => ({ g: g.id, list: shown.filter((e) => e.primary === g.id) })).filter((x) => x.list.length));
</script>

<dialog class="sheet" bind:this={dialog} onclose={onclose}>
  {#if open}
    <div class="stack">
      <div class="row spread">
        <h2>Упражнение</h2>
        <button class="link" onclick={onclose}>Закрыть</button>
      </div>
      <input bind:value={query} placeholder="Поиск" aria-label="Поиск упражнения" />
      <div class="list">
        {#each groups as x (x.g)}
          <span class="section-title">{groupLabel(x.g)}</span>
          {#each x.list as e (e.id)}
            <button class="item" onclick={() => onpick(e.id!)}>{e.name}</button>
          {/each}
        {/each}
        {#if !shown.length}<p class="muted small">Не найдено.</p>{/if}
      </div>
      <button
        class="link small"
        onclick={() => {
          onclose();
          go('gym', 'library');
        }}>Новое упражнение — в «Упражнениях и шаблонах»</button
      >
    </div>
  {/if}
</dialog>

<style>
  .list {
    display: flex;
    flex-direction: column;
    max-height: 60dvh;
    overflow-y: auto;
    gap: 2px;
  }

  .list .section-title {
    margin-top: 10px;
  }

  .item {
    text-align: left;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    border-radius: 0;
    padding: 0 4px;
  }
</style>
