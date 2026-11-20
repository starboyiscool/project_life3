<script lang="ts">
 import { db } from '../lib/app-db';
 import { act, days, live, settings } from '../lib/state.svelte';
 import { diffDays, formatDayShort } from '../lib/logic/day';
 import { workWeekRange } from '../lib/logic/semester';
 import { workToTask } from '../lib/repo/study';
 import { go } from '../lib/nav.svelte';
 import type { Subject, Work } from '../lib/logic/study';
 const upcoming = live(() => {
   const today = days.today, start = settings.semesterStart, number = settings.semesterNumber;
   return async () => {
    const subjects = await db.table<Subject, number>('subjects').toArray();
    const works = await db.table<Work, number>('works').toArray();
    return works.flatMap(work => {
      const subject = subjects.find(s => s.id === work.subjectId);
      if (!subject || work.status === 'passed') return [];
      const range = workWeekRange(work, subject, number, start);
      const effective = work.deadline ?? range?.to;
      if (!effective || diffDays(today, effective) > 7) return [];
      return [{work, subject, sortDay:effective, label: work.deadline ? `${work.deadlineApproximate ? 'примерно ' : 'срок '}${formatDayShort(work.deadline)}` : `${work.deadlineWeek}-я неделя (${formatDayShort(range!.from)}–${formatDayShort(range!.to)})`}];
    }).sort((a,b) => a.sortDay.localeCompare(b.sortDay) || a.work.order-b.work.order).slice(0,3);
   };
 }, [] as {work: Work; subject: Subject; sortDay: string; label: string}[]);
 async function add(w: Work, s: Subject) {
   await act(async () => {if (await workToTask(db,w,s.name,days.today) === 'exists') throw new Error('Работа уже в плане на сегодня.');}, 'Работа добавлена на сегодня');
 }
</script>
{#if upcoming.current.length}
<section class="card stack"><div class="row spread"><h2 class="section-title">Ближайшие сроки · учёба</h2><button class="link small" onclick={() => go('more','study')}>Все</button></div>
 {#each upcoming.current as entry (entry.work.id)}<div class="row spread"><div class="grow"><b>{entry.work.title}</b><p class="muted small">{entry.subject.name} · {entry.label}</p></div><button class="small" onclick={() => add(entry.work,entry.subject)}>+ Сегодня</button></div>{/each}
</section>
{/if}
