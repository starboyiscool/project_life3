import type Dexie from 'dexie';
import { addDays, type Day } from '../logic/day';
import { ruleMatches } from '../logic/recurrence';
import type { MitDayStat } from '../logic/streaks';
import type { RecurringTask, Task } from '../logic/tasks';

const tasks = (db: Dexie) => db.table<Task, number>('tasks');
const recurring = (db: Dexie) => db.table<RecurringTask, number>('recurring');

export type NewTask = Pick<Task, 'title' | 'isMit' | 'category'> &
  Partial<Pick<Task, 'estimateMin' | 'timeStart' | 'timeEnd'>>;

export async function addTask(db: Dexie, day: Day | '', t: NewTask): Promise<number> {
  return tasks(db).add({
    ...t,
    title: t.title.trim(),
    day,
    status: day ? 'open' : 'backlog',
    createdAt: new Date().toISOString(),
  });
}

export async function updateTask(db: Dexie, id: number, changes: Partial<Task>): Promise<void> {
  await tasks(db).update(id, changes);
}

export async function setDone(db: Dexie, id: number, done: boolean): Promise<void> {
  await tasks(db).update(id, done ? { status: 'done', doneAt: new Date().toISOString() } : { status: 'open', doneAt: undefined });
}

/** Move to a day (carry over) or to the backlog (day ''). */
export async function moveTask(db: Dexie, id: number, day: Day | ''): Promise<void> {
  await db.transaction('rw', tasks(db), async () => {
    const t = await tasks(db).get(id);
    if (!t) return;
    await tasks(db).update(id, {
      day,
      status: day ? 'open' : 'backlog',
      // counts real carry-overs from one day to another, not trips to the backlog
      carriedCount: (t.carriedCount ?? 0) + (t.day && day && day !== t.day ? 1 : 0),
    });
  });
}

/**
 * Removes a task. A recurring instance is marked 'dropped' instead, so it is not
 * generated again for that day. Caller confirms with the user.
 */
export async function removeTask(db: Dexie, t: Task): Promise<void> {
  if (t.id == null) return;
  if (t.recurringId != null && t.day) await tasks(db).update(t.id, { status: 'dropped' });
  else await tasks(db).delete(t.id);
}

/** Restore a just-removed task without overwriting newer data. */
export async function restoreRemovedTask(db: Dexie, original: Task): Promise<void> {
  if (original.id == null) throw new Error('Не удалось восстановить задачу без идентификатора.');
  await db.transaction('rw', tasks(db), async () => {
    const current = await tasks(db).get(original.id!);
    if (original.recurringId != null && original.day) {
      if (!current || current.status !== 'dropped' || current.recurringId !== original.recurringId || current.day !== original.day || current.createdAt !== original.createdAt)
        throw new Error('Задача уже изменилась; восстановление отменено.');
      await tasks(db).update(original.id!, { status: original.status });
    } else {
      if (current) throw new Error('Идентификатор уже занят; восстановление отменено.');
      await tasks(db).add(original);
    }
  });
}

/** Tasks shown in a day's plan (open + done, not dropped). */
export async function tasksForDay(db: Dexie, day: Day): Promise<Task[]> {
  const rows = await tasks(db).where('day').equals(day).toArray();
  return rows.filter((t) => t.status === 'open' || t.status === 'done');
}

export async function backlog(db: Dexie): Promise<Task[]> {
  return tasks(db).where('status').equals('backlog').toArray();
}

/** Unfinished tasks from days before `day`. */
export async function leftovers(db: Dexie, day: Day): Promise<Task[]> {
  const rows = await tasks(db).where('day').between('0000-00-00', day, true, false).toArray();
  return rows.filter((t) => t.status === 'open').sort((a, b) => a.day.localeCompare(b.day));
}

/** Done tasks with day in [from, to]. */
export async function doneBetween(db: Dexie, from: Day, to: Day): Promise<Task[]> {
  const rows = await tasks(db).where('day').between(from, to, true, true).toArray();
  return rows.filter((t) => t.status === 'done');
}

export async function mitStats(db: Dexie, from: Day, to: Day): Promise<Record<Day, MitDayStat>> {
  const rows = await tasks(db).where('day').between(from, to, true, true).toArray();
  const stats: Record<Day, MitDayStat> = {};
  for (const t of rows) {
    if (!t.isMit || (t.status !== 'open' && t.status !== 'done')) continue;
    const s = (stats[t.day] ??= { mit: 0, mitDone: 0 });
    s.mit++;
    if (t.status === 'done') s.mitDone++;
  }
  return stats;
}

/** Creates the day's instances of active recurring tasks (idempotent). */
export async function ensureRecurring(db: Dexie, day: Day): Promise<void> {
  await db.transaction('rw', tasks(db), recurring(db), async () => {
    const rules = (await recurring(db).toArray()).filter((r) => r.active && ruleMatches(r.rule, r.startDay, day));
    for (const r of rules) {
      const exists = await tasks(db).where('[recurringId+day]').equals([r.id!, day]).count();
      if (exists) continue;
      await tasks(db).add({
        title: r.title,
        isMit: r.isMit,
        category: r.category,
        estimateMin: r.estimateMin,
        timeStart: r.timeStart,
        day,
        status: 'open',
        createdAt: new Date().toISOString(),
        recurringId: r.id,
      });
    }
  });
}

export async function ensureRecurringRange(db: Dexie, from: Day, to: Day): Promise<void> {
  for (let d = from; d <= to; d = addDays(d, 1)) await ensureRecurring(db, d);
}

export async function saveRecurring(db: Dexie, r: RecurringTask): Promise<number> {
  return recurring(db).put(r);
}

export async function listRecurring(db: Dexie): Promise<RecurringTask[]> {
  return recurring(db).toArray();
}
