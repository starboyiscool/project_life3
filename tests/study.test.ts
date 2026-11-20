import 'fake-indexeddb/auto';
import type Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openAppDb } from '../src/lib/db/database';
import { dumpDb, parseBackup } from '../src/lib/backup';
import { SnapshotStore } from '../src/lib/db/snapshots';
import { admissionOpen, admissionQueue, deadlineLabel, progressOf, upcomingWorks, type Work } from '../src/lib/logic/study';
import { reviewDue, taskWeekStats } from '../src/lib/logic/review';
import type { Task } from '../src/lib/logic/tasks';
import * as S from '../src/lib/repo/study';
import * as T from '../src/lib/repo/tasks';

const w = (id: number, subjectId: number, status: Work['status'], extra: Partial<Work> = {}): Work => ({
  id,
  subjectId,
  kind: 'lab',
  title: `w${id}`,
  status,
  order: id,
  createdAt: '',
  ...extra,
});

describe('study logic', () => {
  it('progress and admission', () => {
    const ws = [w(1, 1, 'passed'), w(2, 1, 'ready'), w(3, 1, 'doing'), w(4, 1, 'todo', { kind: 'exam' })];
    expect(progressOf(ws)).toEqual({ total: 4, passed: 1, ready: 1, doing: 1, ratio: 0.25 });
    expect(admissionOpen(ws)).toBe(false);
    expect(admissionOpen([w(1, 1, 'passed'), w(4, 1, 'todo', { kind: 'exam' })])).toBe(true);
    expect(admissionOpen([w(4, 1, 'todo', { kind: 'exam' })])).toBe(false); // nothing to gate on yet
    expect(progressOf([]).ratio).toBe(0);
  });

  it('queue: open gating works, deadline first, then ready before doing before todo', () => {
    const q = admissionQueue([
      w(1, 1, 'todo'),
      w(2, 1, 'ready'),
      w(3, 2, 'doing', { deadline: '2026-11-20' }),
      w(4, 2, 'passed'),
      w(5, 2, 'todo', { kind: 'exam', deadline: '2026-11-10' }),
      w(6, 1, 'doing'),
    ]);
    expect(q.map((x) => x.id)).toEqual([3, 2, 6, 1]);
  });

  it('today deadlines include overdue and next seven days, exclude completed and undated', () => {
    const works = [w(1, 1, 'todo', { deadline: '2026-11-07' }), w(2, 1, 'passed', { deadline: '2026-11-08' }), w(3, 1, 'ready', { deadline: '2026-11-15' }), w(4, 1, 'todo', { deadline: '2026-11-16' }), w(5, 1, 'doing', { deadline: '2026-11-08', kind: 'exam' }), w(6, 1, 'todo')];
    expect(upcomingWorks(works, '2026-11-08').map((x) => x.id)).toEqual([1, 5, 3]);
    expect(upcomingWorks(works, '2026-11-09').map((x) => x.id)).toEqual([1, 5, 3]);
    expect(upcomingWorks([works[1], works[5]], '2026-11-08')).toEqual([]);
  });

  it('deadline labels are neutral', () => {
    expect(deadlineLabel('2026-11-08', '2026-11-08')).toBe('срок сегодня');
    expect(deadlineLabel('2026-11-11', '2026-11-08')).toBe('срок через 3 дн.');
    expect(deadlineLabel('2026-11-06', '2026-11-08')).toBe('срок был 2 дн. назад');
    expect(deadlineLabel(undefined, '2026-11-08')).toBe('');
  });
});

describe('review logic', () => {
  const t = (status: Task['status'], day: string, extra: Partial<Task> = {}): Task => ({
    title: 'x',
    isMit: false,
    category: 'other',
    day,
    status,
    createdAt: '',
    ...extra,
  });

  it('task stats for a week', () => {
    const s = taskWeekStats(
      [
        t('done', '2026-11-02', { category: 'study' }),
        t('done', '2026-11-03', { carriedCount: 1 }),
        t('open', '2026-11-04', { carriedCount: 2 }),
        t('open', '2026-11-09'), // future: not counted as open
        t('dropped', '2026-11-04'),
      ],
      '2026-11-08',
    );
    expect(s).toEqual({ done: 2, doneCarried: 1, open: 1, openCarried: 1, studyDone: 1 });
  });

  it('review is due on Sunday (this week) and Monday (last week)', () => {
    expect(reviewDue('2026-11-08', 6)).toEqual({ due: true, week: '2026-11-02' });
    expect(reviewDue('2026-11-09', 0)).toEqual({ due: true, week: '2026-11-02' });
    expect(reviewDue('2026-11-04', 2)).toEqual({ due: false, week: '2026-11-02' });
  });
});

describe('study repo', () => {
  let db: Dexie;
  let snaps: SnapshotStore;
  const uid = () => Math.random().toString(36).slice(2);

  beforeEach(async () => {
    snaps = new SnapshotStore(`snap-${uid()}`);
    db = (await openAppDb({ name: `app-${uid()}`, snapshots: snaps })).db;
  });
  afterEach(() => {
    db.close();
    snaps.close();
  });

  it('seeds subjects once, only the works named in the requirements, no deadlines', async () => {
    await S.ensureStudySeed(db);
    await S.ensureStudySeed(db);
    const subs = await S.listSubjects(db);
    expect(subs).toHaveLength(14);
    expect(subs.filter((s) => s.semester === 3)).toHaveLength(6);
    const ws = await S.listWorks(db);
    expect(ws).toHaveLength(9); // 2 course projects, 4 labs + defense, 2 practice papers
    expect(ws.every((x) => !x.deadline && x.status === 'todo')).toBe(true);
  });

  it('persists approximate deadlines and debt flag without migration', async () => {
    const sid = await S.saveSubject(db, { name: 'X', order: 0, createdAt: '' });
    await S.saveWork(db, w(0, sid, 'todo', { id: undefined, kind: 'colloquium', deadline: '2026-12-15', deadlineApproximate: true, isDebt: true }), '2026-11-08');
    expect((await S.listWorks(db))[0]).toMatchObject({kind:'colloquium', deadline:'2026-12-15', deadlineApproximate:true, isDebt:true});
  });

  it('stores and edits semester week independently of dates and includes it in backup', async () => {
    const sid = await S.saveSubject(db, { name: 'Математика', semester: 1, order: 0, createdAt: '' });
    const id = await S.saveWork(db, w(0, sid, 'todo', { id: undefined, kind: 'colloquium', deadlineWeek: 1, isDebt: true }), '2026-11-08');
    let work = (await S.listWorks(db))[0];
    expect(work).toMatchObject({ deadlineWeek: 1, isDebt: true });
    expect(work.deadline).toBeUndefined();
    await S.saveWork(db, { ...work, deadlineWeek: 2, deadline: '2026-12-15', deadlineApproximate: true }, '2026-11-08');
    work = (await S.listWorks(db))[0];
    expect(work).toMatchObject({ id, deadlineWeek: 2, deadline: '2026-12-15', deadlineApproximate: true });
    const backup = parseBackup(JSON.stringify(await dumpDb(db)));
    expect(backup.tables.works[0]).toMatchObject({ deadlineWeek: 2 });
    await S.saveWork(db, { ...work, deadlineWeek: undefined }, '2026-11-08');
    expect((await S.listWorks(db))[0].deadlineWeek).toBeUndefined();
  });

  it('passedDay is stamped on pass, kept on re-save, cleared on going back', async () => {
    const sid = await S.saveSubject(db, { name: 'X', order: 0, createdAt: '' });
    const id = await S.saveWork(db, w(0, sid, 'todo', { id: undefined }), '2026-11-08');
    await S.setWorkStatus(db, id, 'passed', '2026-11-08');
    await S.setWorkStatus(db, id, 'passed', '2026-11-09');
    expect((await S.listWorks(db))[0].passedDay).toBe('2026-11-08');
    expect(await S.worksPassedBetween(db, '2026-11-02', '2026-11-08')).toHaveLength(1);
    await S.setWorkStatus(db, id, 'ready', '2026-11-09');
    expect((await S.listWorks(db))[0].passedDay).toBeUndefined();
  });

  it('work to task: study category, once per day, todo becomes doing', async () => {
    const sid = await S.saveSubject(db, { name: 'Физика', order: 0, createdAt: '' });
    const id = await S.saveWork(db, w(0, sid, 'todo', { id: undefined, title: 'РГР 1' }), '2026-11-08');
    const work = (await S.listWorks(db))[0];
    expect(await S.workToTask(db, work, 'Физика', '2026-11-08')).toBe('added');
    expect(await S.workToTask(db, work, 'Физика', '2026-11-08')).toBe('exists');
    const day = await T.tasksForDay(db, '2026-11-08');
    expect(day.map((x) => [x.title, x.category, x.workId])).toEqual([['Физика: РГР 1', 'study', id]]);
    expect((await S.listWorks(db))[0].status).toBe('doing');
    expect((await S.plannedWorks(db)).get(id)).toHaveLength(1);
  });

  it('deleting a subject removes its works', async () => {
    const sid = await S.saveSubject(db, { name: 'X', order: 0, createdAt: '' });
    await S.saveWork(db, w(0, sid, 'todo', { id: undefined }), '2026-11-08');
    await S.deleteSubject(db, sid);
    expect(await S.listWorks(db)).toHaveLength(0);
  });

  it('review round trip', async () => {
    await S.saveReview(db, { week: '2026-11-02', goals: ['a', '', ''], worked: 'w', didnt: '', updatedAt: '' });
    expect((await S.getReview(db, '2026-11-02'))?.goals[0]).toBe('a');
  });
});
