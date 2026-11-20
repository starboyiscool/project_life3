import 'fake-indexeddb/auto';
import type Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openAppDb } from '../src/lib/db/database';
import { SnapshotStore } from '../src/lib/db/snapshots';
import {
  before,
  markRecords,
  bodyWeightOn,
  epley,
  exerciseSeries,
  newRecords,
  nextWorkout,
  parseKgInput,
  prefillSet,
  progressionHint,
  recordsOf,
  setText,
  volume,
  type Exercise,
  type WorkSet,
  type Workout,
  type WorkoutTemplate,
} from '../src/lib/logic/gym';
import * as G from '../src/lib/repo/gym';
import * as T from '../src/lib/repo/tasks';

const s = (kg: number, reps: number, kind: WorkSet['kind'] = 'work'): WorkSet => ({ kg, reps, kind, at: '' });
const ex = (id: number, load: Exercise['load'], primary: Exercise['primary'] = 'chest'): Exercise => ({
  id,
  name: `e${id}`,
  primary,
  secondary: [],
  load,
  compound: true,
  preset: false,
  createdAt: '',
});
const wo = (id: number, day: string, items: Workout['items'], templateId?: number): Workout => ({
  id,
  day,
  items,
  templateId,
  status: 'done',
  startedAt: day,
});
const tpl = (id: number, order: number): WorkoutTemplate => ({ id, name: `t${id}`, items: [], suggestion: false, order, createdAt: '' });

describe('numbers', () => {
  it('epley', () => {
    expect(epley(62.5, 4)).toBeCloseTo(70.83, 2);
    expect(epley(100, 1)).toBe(100);
    expect(epley(0, 10)).toBe(0);
  });

  it('body weight of the day or the latest before', () => {
    const w = [
      { day: '2026-11-01', kg: 70 },
      { day: '2026-11-05', kg: 71 },
    ];
    expect(bodyWeightOn(w, '2026-11-05')).toBe(71);
    expect(bodyWeightOn(w, '2026-11-04')).toBe(70);
    expect(bodyWeightOn(w, '2026-10-30')).toBeNull();
  });

  it('kg input and set text', () => {
    expect(parseKgInput('62,5')).toBe(62.5);
    expect(parseKgInput('')).toBe(0);
    expect(parseKgInput('-1')).toBeNull();
    expect(setText(s(62.5, 4), 'barbell')).toBe('62,5 × 4');
    expect(setText(s(10, 8), 'bodyweight_plus')).toBe('+10 × 8');
    expect(setText(s(0, 15), 'bodyweight_plus')).toBe('15');
  });
});

describe('prefill and progression', () => {
  const prev = [s(40, 10, 'warmup'), s(62.5, 4), s(62.5, 4)];

  it('same set as last time, then repeat, then target', () => {
    expect(prefillSet(prev, [], undefined)).toEqual({ kg: 40, reps: 10, kind: 'warmup' });
    expect(prefillSet(prev, [s(40, 10, 'warmup')], undefined)).toEqual({ kg: 62.5, reps: 4, kind: 'work' });
    expect(prefillSet(prev, [s(1, 1), s(1, 1), s(60, 5)], undefined)).toEqual({ kg: 60, reps: 5, kind: 'work' });
    expect(prefillSet(undefined, [], { sets: 3, repMin: 6, repMax: 10 })).toEqual({ kg: 0, reps: 6, kind: 'work' });
  });

  it('suggests +step only when every work set hit the top of the range', () => {
    const t = { sets: 2, repMin: 4, repMax: 6 };
    expect(progressionHint([s(20, 3, 'warmup'), s(62.5, 6), s(62.5, 6)], t, 2.5)).toBe(65);
    expect(progressionHint([s(62.5, 6), s(62.5, 5)], t, 2.5)).toBeNull();
    expect(progressionHint([s(62.5, 6)], t, 2.5)).toBeNull(); // fewer sets than planned
    expect(progressionHint([s(62.5, 6), s(62.5, 6)], undefined, 2.5)).toBeNull();
  });
});

describe('records', () => {
  const body = () => 71;

  it('weight, reps at weight, e1RM; warmups ignored; nothing on the first ever set', () => {
    const r = recordsOf([{ day: 'd', sets: [s(100, 1, 'warmup'), s(62.5, 4), s(60, 6)] }], 'barbell', body);
    expect(r.maxKg).toBe(62.5);
    expect(newRecords(s(65, 2), r, 'barbell', null)).toEqual(['kg']); // e1rm 69.3 < 70.8
    expect(newRecords(s(62.5, 5), r, 'barbell', null)).toEqual(['reps', 'e1rm']);
    expect(newRecords(s(60, 6), r, 'barbell', null)).toEqual([]);
    expect(newRecords(s(200, 1, 'warmup'), r, 'barbell', null)).toEqual([]);
    expect(newRecords(s(60, 6), recordsOf([], 'barbell', body), 'barbell', null)).toEqual([]);
  });

  it('pull-ups: added weight and pure reps, e1RM with body weight', () => {
    const r = recordsOf([{ day: 'd', sets: [s(0, 15), s(10, 6)] }], 'bodyweight_plus', body);
    expect(newRecords(s(0, 16), r, 'bodyweight_plus', 71)).toContain('reps');
    expect(newRecords(s(12.5, 5), r, 'bodyweight_plus', 71)).toContain('kg');
    // no body weight → no e1RM comparison
    expect(newRecords(s(0, 16), r, 'bodyweight_plus', null)).toEqual(['reps']);
  });
});

describe('records inside a workout', () => {
  it('marks sets against earlier workouts and earlier sets, ignoring later workouts', () => {
    const exs = new Map([[1, ex(1, 'barbell')]]);
    const old = wo(1, '2026-11-02', [{ exerciseId: 1, sets: [s(60, 5)] }]);
    const later = wo(3, '2026-11-09', [{ exerciseId: 1, sets: [s(100, 5)] }]);
    const w = wo(2, '2026-11-04', [{ exerciseId: 1, sets: [s(62.5, 4), s(62.5, 4), s(62.5, 5)] }]);
    const m = markRecords(w, before([old, later, w], w), exs, () => null);
    expect([...m.keys()]).toEqual(['0:0', '0:2']);
    expect(m.get('0:0')).toContain('kg');
    expect(m.get('0:2')).toEqual(['reps', 'e1rm']);
    // the very first workout with an exercise has no records at all
    expect(markRecords(w, [], exs, () => null).size).toBe(0);
  });
});

describe('schedule', () => {
  const ts = [tpl(1, 0), tpl(2, 1)];

  it('every other day from the last workout, shifted on a miss, rotating templates', () => {
    expect(nextWorkout([], ts, 2, '2026-11-08')).toEqual({ due: '2026-11-08', template: ts[0] });
    const w = [wo(1, '2026-11-06', [], 1)];
    expect(nextWorkout(w, ts, 2, '2026-11-07')).toEqual({ due: '2026-11-08', template: ts[1] });
    // missed 08 and 09: due today, the same template (the cycle is not broken)
    expect(nextWorkout(w, ts, 2, '2026-11-10')).toEqual({ due: '2026-11-10', template: ts[1] });
    expect(nextWorkout([wo(2, '2026-11-08', [], 2), ...w], ts, 2, '2026-11-08').template).toBe(ts[0]);
  });
});

describe('progress', () => {
  const exs = new Map([
    [1, ex(1, 'barbell', 'chest')],
    [2, ex(2, 'bodyweight_plus', 'back')],
  ]);

  it('volume per exercise and group, partial when body weight unknown', () => {
    const ws = [wo(1, '2026-11-02', [{ exerciseId: 1, sets: [s(20, 10, 'warmup'), s(60, 5), s(60, 5)] }, { exerciseId: 2, sets: [s(0, 10)] }])];
    const v = volume(ws, exs, () => 70);
    expect(v.byExercise.get(1)).toEqual({ sets: 2, reps: 10, tonnage: 600, partial: false });
    expect(v.byGroup.get('back')).toEqual({ sets: 1, reps: 10, tonnage: 700, partial: false });
    expect(volume(ws, exs, () => null).byGroup.get('back')?.partial).toBe(true);
  });

  it('series: best e1RM per workout, oldest first', () => {
    const ws = [wo(2, '2026-11-04', [{ exerciseId: 1, sets: [s(62.5, 4)] }]), wo(1, '2026-11-02', [{ exerciseId: 1, sets: [s(60, 5), s(60, 3)] }])];
    const pts = exerciseSeries(ws, exs.get(1)!, () => null);
    expect(pts.map((p) => p.day)).toEqual(['2026-11-02', '2026-11-04']);
    expect(pts[0].e1rm).toBeCloseTo(70, 5);
    expect(pts[1].maxKg).toBe(62.5);
  });
});

describe('gym repo', () => {
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

  it('seeds presets and a suggested template once, without weights', async () => {
    await G.ensureGymSeed(db);
    await G.ensureGymSeed(db);
    const exs = await G.listExercises(db);
    expect(exs.length).toBe(8);
    expect(exs.map((e) => e.name)).toContain('Подтягивания');
    const ts = await G.listTemplates(db);
    expect(ts).toHaveLength(1);
    expect(ts[0].suggestion).toBe(true);
    expect(ts[0].items.every((i) => i.exerciseId > 0)).toBe(true);
    expect(JSON.stringify(ts[0])).not.toMatch(/"kg"/);
    // editing makes it the user's own
    await G.saveTemplate(db, ts[0]);
    expect((await G.listTemplates(db))[0].suggestion).toBe(false);
  });

  it('workout flow: start, sets, finish drops empty items and checks the training task', async () => {
    await G.ensureGymSeed(db);
    const [t] = await G.listTemplates(db);
    const taskId = await T.addTask(db, '2026-11-08', { title: 'Зал', isMit: false, category: 'training' });
    const id = await G.startWorkout(db, '2026-11-08', t);
    expect(await G.startWorkout(db, '2026-11-08', t)).toBe(id); // one active at a time
    await G.addSet(db, id, 0, s(0, 12));
    await G.addSet(db, id, 0, s(5, 8));
    await G.updateSet(db, id, 0, 1, s(5, 9));
    await G.deleteSet(db, id, 0, 0);
    await G.finishWorkout(db, id);
    const w = (await G.getWorkout(db, id))!;
    expect(w.status).toBe('done');
    expect(w.items).toHaveLength(1);
    expect(w.items[0].sets.map((x) => x.reps)).toEqual([9]);
    expect((await T.tasksForDay(db, '2026-11-08')).find((x) => x.id === taskId)?.status).toBe('done');
    expect(await G.activeWorkout(db)).toBeUndefined();
  });

  it('adds a done «Тренировка» task when the day had none', async () => {
    const id = await G.startWorkout(db, '2026-11-08', null);
    await G.finishWorkout(db, id);
    const day = await T.tasksForDay(db, '2026-11-08');
    expect(day.map((x) => [x.title, x.status, x.category])).toEqual([['Тренировка', 'done', 'training']]);
  });

  it('a used exercise is archived, an unused one deleted', async () => {
    await G.ensureGymSeed(db);
    const exs = await G.listExercises(db);
    const used = exs.find((e) => e.name === 'Жим лёжа')!;
    const unused = exs.find((e) => e.name === 'Молотковые сгибания')!;
    expect(await G.removeExercise(db, used.id!)).toBe('archived');
    expect(await G.removeExercise(db, unused.id!)).toBe('deleted');
  });

  it('past workout is created done and does not block an active one', async () => {
    const past = await G.startWorkout(db, '2026-11-01', null, true);
    expect((await G.getWorkout(db, past))?.status).toBe('done');
    const a = await G.startWorkout(db, '2026-11-08', null);
    expect(a).not.toBe(past);
  });
});
