<script lang="ts">
  import { db } from '../lib/app-db';
  import { days, live } from '../lib/state.svelte';
  import { go } from '../lib/nav.svelte';
  import { weekday } from '../lib/logic/day';
  import { reviewDue } from '../lib/logic/review';
  import { getReview } from '../lib/repo/study';

  const due = $derived(reviewDue(days.today, weekday(days.today)));
  const saved = live(
    () => {
      const w = due.week;
      return async () => !!(await getReview(db, w))?.updatedAt;
    },
    true,
  );
</script>

{#if due.due && saved.loaded && !saved.current}
  <section class="card row spread">
    <span>Недельный обзор, 10 минут</span>
    <button class="primary" onclick={() => go('more', 'review')}>Открыть</button>
  </section>
{/if}
