import type Dexie from 'dexie';
import type { Day } from '../logic/day';
import {
  PRESET_EXERCISES,
  SUGGESTED_UPPER,
  type Exercise,
  type WorkSet,
  type Workout,
  type WorkoutItem,
  type WorkoutTemplate,
} from '../logic/gym';
import type { Task } from '../logic/tasks';

const exercises = (db: Dexie) => db.table<Exercise, number>('exercises');
const templates = (db: Dexie) => db.table<WorkoutTemplate, number>('workoutTemplates');
const workouts = (db: Dexie) => db.table<Workout, number>('workouts');
const tasks = (db: Dexie) => db.table<Task, number>('tasks');
const meta = (db: Dexie) => db.table<{ key: string; value: unknown }, string>('meta');

const now = () => new Date().toISOString();

/** Adds the basic exercises and the «Верх» suggestion once (meta 'gymSeeded'). */
export async function ensureGymSeed(db: Dexie): Promise<void> {
  await db.transaction('rw', exercises(db), templates(db), meta(db), async () => {
    if (await meta(db).get('gymSeeded')) return;
    await meta(db).put({ key: 'gymSeeded', value: now() });
    if ((await exercises(db).count()) || (await templates(db).count())) return;
    const ids = new Map<string, number>();
    for (const p of PRESET_EXERCISES) ids.set(p.name, await exercises(db).add({ ...p, preset: true, createdAt: now() }));
    await templates(db).add({
      name: 'Верх',
      suggestion: true,
      order: 0,
      createdAt: now(),
      items: SUGGESTED_UPPER.map((s) => ({ exerciseId: ids.get(s.name)!, sets: s.sets, repMin: s.repMin, repMax: s.repMax })),
    });
  });
}

// ---------- exercises ----------

export async function listExercises(db: Dexie): Promise<Exercise[]> {
  return (await exercises(db).toArray()).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export async function saveExercise(db: Dexie, e: Exercise): Promise<number> {
  return exercises(db).put({ ...e, name: e.name.trim() });
}

export async function isExerciseUsed(db: Dexie, id: number): Promise<boolean> {
  const inTemplates = (await templates(db).toArray()).some((t) => t.items.some((i) => i.exerciseId === id));
  if (inTemplates) return true;
  return (await workouts(db).toArray()).some((w) => w.items.some((i) => i.exerciseId === id));
}

/** Unused exercises are deleted; used ones are archived so history keeps its names. */
export async function removeExercise(db: Dexie, id: number): Promise<'deleted' | 'archived'> {
  if (await isExerciseUsed(db, id)) {
    await exercises(db).update(id, { archived: true });
    return 'archived';
  }
  await exercises(db).delete(id);
  return 'deleted';
}

// ---------- templates ----------

export async function listTemplates(db: Dexie): Promise<WorkoutTemplate[]> {
  return (await templates(db).toArray()).sort((a, b) => a.order - b.order);
}

/** Saving a template means the user owns it now: the «предложение» mark goes away. */
export async function saveTemplate(db: Dexie, t: WorkoutTemplate): Promise<number> {
  const order = t.id != null ? t.order : ((await templates(db).toArray()).reduce((m, x) => Math.max(m, x.order), -1) + 1);
  return templates(db).put({ ...t, name: t.name.trim(), order, suggestion: false });
}

export async function deleteTemplate(db: Dexie, id: number): Promise<void> {
  await templates(db).delete(id);
}

// ---------- workouts ----------

export async function activeWorkout(db: Dexie): Promise<Workout | undefined> {
  return workouts(db).where('status').equals('active').first();
}

/** Done workouts, newest first. */
export async function listDone(db: Dexie): Promise<Workout[]> {
  const rows = await workouts(db).where('status').equals('done').toArray();
  return rows.sort((a, b) => b.day.localeCompare(a.day) || b.startedAt.localeCompare(a.startedAt));
}

export async function doneBetween(db: Dexie, from: Day, to: Day): Promise<Workout[]> {
  const rows = await workouts(db).where('day').between(from, to, true, true).toArray();
  return rows.filter((w) => w.status === 'done');
}

export async function getWorkout(db: Dexie, id: number): Promise<Workout | undefined> {
  return workouts(db).get(id);
}

/**
 * Starts a workout (status 'active'), or for a past day creates it as done right away
 * so it can be filled in after the fact. Only one active workout at a time.
 */
export async function startWorkout(db: Dexie, day: Day, template: WorkoutTemplate | null, past = false): Promise<number> {
  return db.transaction('rw', workouts(db), async () => {
    if (!past) {
      const a = await workouts(db).where('status').equals('active').first();
      if (a) return a.id!;
    }
    const items: WorkoutItem[] = (template?.items ?? []).map((i) => ({
      exerciseId: i.exerciseId,
      target: { sets: i.sets, repMin: i.repMin, repMax: i.repMax },
      sets: [],
    }));
    return workouts(db).add({
      day,
      templateId: template?.id,
      status: past ? 'done' : 'active',
      items,
      startedAt: now(),
      finishedAt: past ? now() : undefined,
    });
  });
}

async function mutate(db: Dexie, id: number, fn: (w: Workout) => void): Promise<void> {
  await db.transaction('rw', workouts(db), async () => {
    const w = await workouts(db).get(id);
    if (!w) throw new Error('Тренировка не найдена');
    fn(w);
    await workouts(db).put(w);
  });
}

export const addSet = (db: Dexie, id: number, itemIdx: number, s: WorkSet) => mutate(db, id, (w) => void w.items[itemIdx].sets.push(s));

export const updateSet = (db: Dexie, id: number, itemIdx: number, setIdx: number, s: WorkSet) =>
  mutate(db, id, (w) => void (w.items[itemIdx].sets[setIdx] = s));

export const deleteSet = (db: Dexie, id: number, itemIdx: number, setIdx: number) =>
  mutate(db, id, (w) => void w.items[itemIdx].sets.splice(setIdx, 1));

export const addItem = (db: Dexie, id: number, exerciseId: number) => mutate(db, id, (w) => void w.items.push({ exerciseId, sets: [] }));

export const removeItem = (db: Dexie, id: number, itemIdx: number) => mutate(db, id, (w) => void w.items.splice(itemIdx, 1));

export const moveItem = (db: Dexie, id: number, itemIdx: number, dir: -1 | 1) =>
  mutate(db, id, (w) => {
    const j = itemIdx + dir;
    if (j < 0 || j >= w.items.length) return;
    [w.items[itemIdx], w.items[j]] = [w.items[j], w.items[itemIdx]];
  });

export const updateWorkout = (db: Dexie, id: number, changes: Partial<Pick<Workout, 'day' | 'note'>>) =>
  mutate(db, id, (w) => void Object.assign(w, changes));

export async function deleteWorkout(db: Dexie, id: number): Promise<void> {
  await workouts(db).delete(id);
}

/**
 * Finishes the workout: exercises without sets are dropped, and the day's open
 * «Тренировка» task gets checked (or a done one is added, so the done log shows it).
 */
export async function finishWorkout(db: Dexie, id: number): Promise<void> {
  await db.transaction('rw', workouts(db), tasks(db), async () => {
    const w = await workouts(db).get(id);
    if (!w) return;
    w.items = w.items.filter((i) => i.sets.length);
    w.status = 'done';
    w.finishedAt = now();
    await workouts(db).put(w);
    const dayTasks = await tasks(db).where('day').equals(w.day).toArray();
    const training = dayTasks.filter((t) => t.category === 'training' && (t.status === 'open' || t.status === 'done'));
    const open = training.filter((t) => t.status === 'open');
    if (open.length) {
      for (const t of open) await tasks(db).update(t.id!, { status: 'done', doneAt: now() });
    } else if (!training.length) {
      await tasks(db).add({ title: 'Тренировка', isMit: false, category: 'training', day: w.day, status: 'done', createdAt: now(), doneAt: now() });
    }
  });
}
