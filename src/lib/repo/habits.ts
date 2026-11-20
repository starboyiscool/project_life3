import type Dexie from 'dexie';
import type { Day } from '../logic/day';
import type { Habit, HabitLog } from '../logic/habits';

const habits = (db: Dexie) => db.table<Habit, number>('habits');
const logs = (db: Dexie) => db.table<HabitLog, [number, string]>('habitLogs');

export async function listHabits(db: Dexie, includeArchived = false): Promise<Habit[]> {
  const all = await habits(db).toArray();
  return all.filter((h) => includeArchived || !h.archived).sort((a, b) => a.order - b.order);
}

export async function addHabit(db: Dexie, h: Pick<Habit, 'name' | 'schedule'>, startDay: Day): Promise<number> {
  const max = (await habits(db).toArray()).reduce((m, x) => Math.max(m, x.order), 0);
  return habits(db).add({
    name: h.name.trim(),
    schedule: h.schedule,
    order: max + 1,
    archived: false,
    startDay,
    createdAt: new Date().toISOString(),
  });
}

export async function updateHabit(db: Dexie, id: number, changes: Partial<Habit>): Promise<void> {
  await habits(db).update(id, changes);
}

export async function setHabitDone(db: Dexie, habitId: number, day: Day, done: boolean): Promise<void> {
  if (done) await logs(db).put({ habitId, day });
  else await logs(db).delete([habitId, day]);
}

/** habitId → set of done days within [from, to]. */
export async function habitDoneDays(db: Dexie, from: Day, to: Day): Promise<Map<number, Set<Day>>> {
  const rows = await logs(db).where('day').between(from, to, true, true).toArray();
  const map = new Map<number, Set<Day>>();
  for (const r of rows) {
    let s = map.get(r.habitId);
    if (!s) map.set(r.habitId, (s = new Set()));
    s.add(r.day);
  }
  return map;
}
