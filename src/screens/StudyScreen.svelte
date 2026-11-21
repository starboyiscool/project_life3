<script lang="ts">
  import { db } from '../lib/app-db';
  import { act, days, live, settings } from '../lib/state.svelte';
  import { listSubjects, listWorks, saveSubject, saveWork, deleteSubject, deleteWork, workToTask } from '../lib/repo/study';
  import { workWeekRange } from '../lib/logic/semester';
  import { formatDayShort } from '../lib/logic/day';
  import { WORK_KINDS, WORK_STATUSES, kindLabel, statusLabel, type Subject, type Work, type WorkKind, type WorkStatus } from '../lib/logic/study';

  const subjects = live(() => () => listSubjects(db), [] as Subject[]);
  const works = live(() => () => listWorks(db), [] as Work[]);
  let view = $state<'all' | 'debt' | 'weeks'>('all');
  const usedWeeks = $derived([...new Set(works.current.map(w => w.deadlineWeek).filter((w): w is number => !!w))].sort((a,b) => a-b));
  let subjectName = $state('');
  let semester = $state('');
  let editingSubject = $state<Subject | null>(null);
  let editName = $state('');
  let editSemester = $state('');
  let currentSubject = $state<number | null>(null);
  let editing = $state<Work | null>(null);
  let title = $state('');
  let kind = $state<WorkKind>('lab');
  let status = $state<WorkStatus>('todo');
  let deadline = $state('');
  let deadlineWeek = $state('');
  const weeks = Array.from({ length: 52 }, (_, i) => i + 1);
  let approximate = $state(false);
  let debt = $state(false);
  let note = $state('');
  let showForm = $state(false);
  let dialog: HTMLDialogElement;
  $effect(() => { if (showForm && !dialog.open) dialog.showModal(); else if (!showForm && dialog.open) dialog.close(); });

  async function addSubject(e: SubmitEvent) {
    e.preventDefault();
    if (!subjectName.trim()) return;
    const name = subjectName.trim();
    if (await act(() => saveSubject(db, { name, semester: semester ? Number(semester) : undefined, order: 0, createdAt: new Date().toISOString() }), 'Предмет добавлен')) { subjectName = ''; semester = ''; }
  }
  function startSubjectEdit(s: Subject) { editingSubject = s; editName = s.name; editSemester = s.semester ? String(s.semester) : ''; }
  async function submitSubject(e: SubmitEvent) {
    e.preventDefault(); if (!editingSubject || !editName.trim()) return;
    const subject = { ...$state.snapshot(editingSubject), name: editName.trim(), semester: editSemester ? Number(editSemester) : undefined };
    if (await act(() => saveSubject(db, subject), 'Предмет сохранён')) editingSubject = null;
  }
  function editWork(subjectId: number, w?: Work) {
    currentSubject = subjectId; editing = w ?? null;
    title = w?.title ?? ''; kind = w?.kind ?? 'lab'; status = w?.status ?? 'todo';
    deadline = w?.deadline ?? ''; deadlineWeek = w?.deadlineWeek ? String(w.deadlineWeek) : ''; approximate = w?.deadlineApproximate ?? false;
    // Existing records predate the flag and were originally study debts.
    debt = w ? w.isDebt !== false : view === 'debt'; note = w?.note ?? ''; showForm = true;
  }
  async function submitWork(e: SubmitEvent) {
    e.preventDefault(); if (!currentSubject || !title.trim()) return;
    const w: Work = { ...(editing ?? { subjectId: currentSubject, order: 0, createdAt: new Date().toISOString() }), title: title.trim(), kind, status, deadline: deadline || undefined, deadlineWeek: deadlineWeek ? Number(deadlineWeek) : undefined, deadlineApproximate: !!deadline && approximate, isDebt: debt, note: note.trim() || undefined };
    if (await act(() => saveWork(db, w, days.today), 'Работа сохранена')) showForm = false;
  }
  async function addToToday(w: Work, s: Subject) {
    await act(async () => {
      const result = await workToTask(db, w, s.name, days.today);
      if (result === 'exists') throw new Error('Эта работа уже есть в плане на сегодня.');
    }, 'Добавлено в план на сегодня');
  }
</script>

<div class="stack">
  <div class="seg" role="group" aria-label="Раздел учёбы">
    <button class:on={view === 'all'} onclick={() => view = 'all'}>Предметы</button>
    <button class:on={view === 'debt'} onclick={() => view = 'debt'}>Долги</button>
    <button class:on={view === 'weeks'} onclick={() => view = 'weeks'}>По неделям</button>
  </div>
  <p class="muted small">{view === 'all' ? 'Добавляйте предметы и работы на семестр. Выберите неделю семестра, дату или оба срока. Дату можно отметить как примерную.' : view === 'debt' ? 'Здесь показаны работы с отметкой «Задолженность». Ранее сохранённые учебные работы также показаны здесь.' : 'Работы сгруппированы по номеру учебной недели; предмет и семестр указаны рядом.'}</p>
  {#if subjects.loaded && !subjects.current.length}<p class="muted">Предметов пока нет. Добавьте первый ниже.</p>{/if}
  {#if view === 'weeks'}
    {#if !usedWeeks.length}<p class="muted">Пока нет работ с указанной неделей.</p>{/if}
    {#each usedWeeks as week (week)}
      <section class="card stack"><h2>{week}-я неделя{#if week === 7 || week === 14} · контрольная{/if}</h2>
        {#each works.current.filter(w => w.deadlineWeek === week) as w (w.id)}
          {@const subject = subjects.current.find(s => s.id === w.subjectId)}
          {#if subject}<div class="work"><b>{w.title}</b><p class="muted small">{subject.name}{#if subject.semester} · семестр {subject.semester}{/if} · {statusLabel(w.status)}</p></div>{/if}
        {/each}
      </section>
    {/each}
  {:else}
  {#each subjects.current as subject (subject.id)}
    {@const items = works.current.filter(w => w.subjectId === subject.id && (view === 'all' || w.isDebt !== false))}
    {#if view === 'all' || items.length}
      <section class="card stack">
        <div class="row spread"><div><h2>{subject.name}</h2>{#if subject.semester}<span class="muted small">Семестр {subject.semester}</span>{/if}</div>
          <button class="link small" onclick={() => startSubjectEdit(subject)}>Изменить</button><button class="link small danger" onclick={() => confirm(`Удалить предмет «${subject.name}» и все его работы? Задачи в плане останутся.`) && act(() => deleteSubject(db, subject.id!))}>Удалить</button></div>
        {#if editingSubject?.id === subject.id}
          <form class="stack" onsubmit={submitSubject}>
            <label class="lbl"><span>Название предмета</span><input bind:value={editName} required /></label>
            <label class="lbl"><span>Номер семестра</span><input type="number" min="1" max="30" bind:value={editSemester} /></label>
            <div class="row"><button type="button" onclick={() => editingSubject = null}>Отмена</button><button type="submit" class="primary">Сохранить</button></div>
          </form>
        {/if}
        {#each items as w (w.id)}
          {@const range = workWeekRange(w, subject, settings.semesterNumber, settings.semesterStart)}
          <div class="work stack">
            <div><b>{w.title}</b> {#if w.isDebt !== false}<span class="badge">Долг</span>{/if}<p class="muted small">{kindLabel(w.kind)} · {statusLabel(w.status)}{#if w.deadlineWeek} · {w.deadlineWeek}-я неделя семестра{#if range} ({formatDayShort(range.from)} — {formatDayShort(range.to)}){/if}{/if}{#if w.deadline} · {w.deadlineApproximate ? 'примерно до ' : 'срок '}{w.deadline}{/if}</p>{#if w.note}<p class="small">{w.note}</p>{/if}</div>
            <div class="chips"><button class="small" onclick={() => editWork(subject.id!, w)}>Изменить</button>{#if w.status !== 'passed'}<button class="small" onclick={() => addToToday(w, subject)}>+ Сегодня</button>{/if}<button class="link small danger" onclick={() => confirm(`Удалить работу «${w.title}»?`) && act(() => deleteWork(db, w.id!))}>Удалить</button></div>
          </div>
        {/each}
        {#if !items.length}<p class="muted small">Работ пока нет.</p>{/if}
        <button onclick={() => editWork(subject.id!)}>+ Добавить работу</button>
      </section>
    {/if}
  {/each}
  <form class="card stack" onsubmit={addSubject}>
    <h2>Новый предмет</h2>
    <label class="lbl"><span>Название</span><input bind:value={subjectName} required /></label>
    <label class="lbl"><span>Семестр (необязательно)</span><input type="number" min="1" max="30" bind:value={semester} /></label>
    <button class="primary" type="submit" disabled={!subjectName.trim()}>Добавить предмет</button>
  </form>
  {/if}
</div>

<dialog bind:this={dialog} class="card form" aria-labelledby="work-title" onclose={() => showForm = false}>
    {#if showForm}
      <form class="stack" onsubmit={submitWork}>
        <h2 id="work-title">{editing ? 'Изменить работу' : 'Новая работа'}</h2>
        <label class="lbl"><span>Что нужно сделать</span><input bind:value={title} required /></label>
        <label class="lbl"><span>Тип</span><select bind:value={kind}>{#each WORK_KINDS as k (k.id)}<option value={k.id}>{k.label}</option>{/each}</select></label>
        <label class="lbl"><span>Статус</span><select bind:value={status}>{#each WORK_STATUSES as s (s.id)}<option value={s.id}>{s.label}</option>{/each}</select></label>
        <label class="lbl"><span>Неделя семестра (необязательно)</span><select bind:value={deadlineWeek}><option value="">Не указана</option>{#each weeks as week (week)}<option value={String(week)}>{week}-я неделя</option>{/each}</select><span class="muted small">Диапазон дат рассчитывается, если указан текущий семестр и его начало.</span></label>
        <label class="lbl"><span>Срок (необязательно)</span><input type="date" bind:value={deadline} /></label>
        <label class="row"><input class="check" type="checkbox" bind:checked={approximate} disabled={!deadline} /> Срок примерный</label>
        <label class="row"><input class="check" type="checkbox" bind:checked={debt} /> Задолженность</label>
        <label class="lbl"><span>Примечание</span><textarea bind:value={note}></textarea></label>
        <div class="row"><button type="button" onclick={() => showForm = false}>Отмена</button><button class="primary" type="submit" disabled={!title.trim()}>Сохранить</button></div>
      </form>
    {/if}
</dialog>
<style>
  .work { border-top: 1px solid var(--border); padding-top: 12px; }
  .badge { font-size: var(--fs-xs); border-radius: 999px; background: var(--surface-2); padding: 2px 7px; }
  dialog::backdrop { background: var(--backdrop); }
  .form { width: min(560px, 100%); max-height: calc(100dvh - 24px); overflow-y: auto; }
  .check { width: 20px; height: 20px; flex: none; }
  textarea { padding: 10px 12px; min-height: 80px; }
</style>
