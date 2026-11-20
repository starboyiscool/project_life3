<script lang="ts">
  import { db } from '../lib/app-db';
  import { act, live, settings } from '../lib/state.svelte';
  import { workWeekRange } from '../lib/logic/semester';
  import { workToTask } from '../lib/repo/study';
  import type { Subject, Work } from '../lib/logic/study';
  import type { Day } from '../lib/logic/day';
  let { day, includeWeek }: { day: Day; includeWeek: boolean } = $props();
  const entries = live(() => {
    const d = day, include = includeWeek, start = settings.semesterStart, number = settings.semesterNumber;
    return async () => {
      const subjects = await db.table<Subject, number>('subjects').toArray();
      const works = await db.table<Work, number>('works').toArray();
      return works.flatMap(work => {
        if (work.status === 'passed') return [];
        const subject = subjects.find(s => s.id === work.subjectId);
        if (!subject) return [];
        const range = workWeekRange(work, subject, number, start);
        const match = work.deadline === d || (!work.deadline && include && range && d >= range.from && d <= range.to);
        return match ? [{work, subject, weekOnly: !work.deadline}] : [];
      });
    };
  }, [] as {work: Work; subject: Subject; weekOnly: boolean}[]);
  async function add(work: Work, subject: Subject) {
    await act(async () => {
      if (await workToTask(db, work, subject.name, day) === 'exists') throw new Error('Работа уже добавлена в план на этот день.');
    }, 'Работа добавлена в план');
  }
</script>
{#if entries.current.length}
<section class="card stack"><h2 class="section-title">Учебные работы</h2>
 {#each entries.current as entry (entry.work.id)}<div class="row spread"><div class="grow"><b>{entry.work.title}</b><p class="muted small">{entry.subject.name} · {entry.weekOnly ? `${entry.work.deadlineWeek}-я неделя (примерно)` : entry.work.deadlineApproximate ? 'примерная дата' : 'срок'}</p></div><button class="small" onclick={() => add(entry.work, entry.subject)}>+ В план</button></div>{/each}
</section>
{/if}
