import 'fake-indexeddb/auto';
import type Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb, openAppDb } from '../src/lib/db/database';
import { SnapshotStore } from '../src/lib/db/snapshots';
import { migrations } from '../src/lib/db/migrations';
import * as T from '../src/lib/repo/tasks';
import * as H from '../src/lib/repo/habits';
import * as W from '../src/lib/repo/weights';

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

const task = (title: string, isMit = false) => ({ title, isMit, category: 'other' as const });

describe('schema v1 → v2', () => {
  it('keeps existing meta and adds the new tables', async () => {
    const name = `old-${uid()}`;
    const v1 = createDb(name, migrations.filter((m) => m.version === 1));
    await v1.open();
    await v1.table('meta').put({ key: 'lastExportAt', value: 'x' });
    v1.close();
    const s = new SnapshotStore(`snap-${uid()}`);
    const { db: d, migratedFrom } = await openAppDb({ name, snapshots: s });
    expect(migratedFrom).toBe(1);
    expect(await d.table('meta').get('lastExportAt')).toEqual({ key: 'lastExportAt', value: 'x' });
    expect(d.tables.map((t) => t.name).sort()).toEqual([
      'dishes',
      'exercises',
      'foodLog',
      'foods',
      'habitLogs',
      'habits',
      'meta',
      'nutritionGoals',
      'recurring',
      'reviews',
      'subjects',
      'tasks',
      'weights',
      'workoutTemplates',
      'workouts',
      'works',
    ]);
    expect((await s.list())[0].reason).toBe('pre-migration');
    d.close();
    s.close();
  });
});

describe('tasks', () => {
  it('day plan, done, leftovers, carry over and backlog', async () => {
    const a = await T.addTask(db, '2026-11-07', task('старое'));
    const b = await T.addTask(db, '2026-11-07', task('сделано'));
    await T.setDone(db, b, true);
    await T.addTask(db, '2026-11-08', task('сегодня'));
    await T.addTask(db, '', task('когда-нибудь'));

    expect((await T.leftovers(db, '2026-11-08')).map((t) => t.title)).toEqual(['старое']);
    expect((await T.backlog(db)).map((t) => t.title)).toEqual(['когда-нибудь']);

    await T.moveTask(db, a, '2026-11-08');
    expect(await T.leftovers(db, '2026-11-08')).toHaveLength(0);
    const today = await T.tasksForDay(db, '2026-11-08');
    expect(today.map((t) => t.title).sort()).toEqual(['сегодня', 'старое']);
    expect(today.find((t) => t.title === 'старое')!.carriedCount).toBe(1);

    await T.moveTask(db, a, '');
    expect((await T.backlog(db)).map((t) => t.title).sort()).toEqual(['когда-нибудь', 'старое']);
    expect((await db.table('tasks').get(a)).carriedCount).toBe(1); // backlog is not a carry-over

    const done = await T.doneBetween(db, '2026-11-01', '2026-11-08');
    expect(done.map((t) => t.title)).toEqual(['сделано']);
    expect(done[0].doneAt).toBeTruthy();
  });

  it('MIT stats per day ignore dropped and backlog tasks', async () => {
    const m1 = await T.addTask(db, '2026-11-08', task('m1', true));
    await T.addTask(db, '2026-11-08', task('m2', true));
    await T.addTask(db, '2026-11-08', task('обычная'));
    await T.setDone(db, m1, true);
    expect(await T.mitStats(db, '2026-11-01', '2026-11-08')).toEqual({ '2026-11-08': { mit: 2, mitDone: 1 } });
  });

  it('recurring instances are created once and a dropped one is not recreated', async () => {
    const rid = await T.saveRecurring(db, {
      title: 'английский',
      isMit: false,
      category: 'study',
      rule: { type: 'interval', every: 2 },
      startDay: '2026-11-08',
      active: true,
      createdAt: '',
    });
    await T.ensureRecurringRange(db, '2026-11-07', '2026-11-10');
    await T.ensureRecurring(db, '2026-11-08');
    expect((await T.tasksForDay(db, '2026-11-08')).map((t) => t.recurringId)).toEqual([rid]);
    expect(await T.tasksForDay(db, '2026-11-09')).toHaveLength(0);
    expect(await T.tasksForDay(db, '2026-11-10')).toHaveLength(1);
    expect(await T.tasksForDay(db, '2026-11-07')).toHaveLength(0);

    const [inst] = await T.tasksForDay(db, '2026-11-10');
    await T.removeTask(db, inst);
    await T.ensureRecurring(db, '2026-11-10');
    expect(await T.tasksForDay(db, '2026-11-10')).toHaveLength(0);
  });

  it('restores ordinary and recurring tasks without overwriting newer rows', async () => {
    const id = await T.addTask(db, '2026-11-08', task('учебная'));
    await db.table('tasks').update(id, { workId: 42, carriedCount: 2 });
    const original = await db.table('tasks').get(id);
    await T.removeTask(db, original);
    await T.restoreRemovedTask(db, original);
    expect(await db.table('tasks').get(id)).toEqual(original);
    await expect(T.restoreRemovedTask(db, original)).rejects.toThrow();
    const rid = await T.saveRecurring(db, { title: 'повтор', isMit: false, category: 'study', rule: { type: 'interval', every: 1 }, startDay: '2026-11-08', active: true, createdAt: '' });
    await T.ensureRecurring(db, '2026-11-08');
    const recurring = (await T.tasksForDay(db, '2026-11-08')).find((x) => x.recurringId === rid)!;
    await T.removeTask(db, recurring);
    await T.ensureRecurring(db, '2026-11-08');
    await T.restoreRemovedTask(db, recurring);
    expect(await db.table('tasks').get(recurring.id!)).toEqual(recurring);
    await expect(T.restoreRemovedTask(db, recurring)).rejects.toThrow();
  });

  it('a regular task is really deleted', async () => {
    const id = await T.addTask(db, '2026-11-08', task('x'));
    await T.removeTask(db, { ...(await db.table('tasks').get(id)) });
    expect(await db.table('tasks').count()).toBe(0);
  });
});

describe('habits and weight', () => {
  it('toggle habit days', async () => {
    const h = await H.addHabit(db, { name: ' вода ', schedule: { type: 'daily' } }, '2026-11-08');
    await H.setHabitDone(db, h, '2026-11-07', true);
    await H.setHabitDone(db, h, '2026-11-08', true);
    await H.setHabitDone(db, h, '2026-11-08', true); // idempotent
    let map = await H.habitDoneDays(db, '2026-11-01', '2026-11-08');
    expect([...map.get(h)!].sort()).toEqual(['2026-11-07', '2026-11-08']);
    await H.setHabitDone(db, h, '2026-11-08', false);
    map = await H.habitDoneDays(db, '2026-11-01', '2026-11-08');
    expect([...map.get(h)!]).toEqual(['2026-11-07']);
    expect((await H.listHabits(db))[0].name).toBe('вода');
  });

  it('archived habits are hidden by default', async () => {
    const h = await H.addHabit(db, { name: 'a', schedule: { type: 'weekly', times: 3 } }, '2026-11-08');
    await H.updateHabit(db, h, { archived: true });
    expect(await H.listHabits(db)).toHaveLength(0);
    expect(await H.listHabits(db, true)).toHaveLength(1);
  });

  it('one weight per day, latest wins', async () => {
    await W.saveWeight(db, '2026-11-08', 71);
    await W.saveWeight(db, '2026-11-07', 70.8);
    await W.saveWeight(db, '2026-11-08', 71.2);
    expect((await W.listWeights(db)).map((w) => [w.day, w.kg])).toEqual([
      ['2026-11-07', 70.8],
      ['2026-11-08', 71.2],
    ]);
    expect((await W.lastWeight(db))!.kg).toBe(71.2);
  });
});
