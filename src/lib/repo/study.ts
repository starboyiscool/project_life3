import type Dexie from 'dexie';
import type { Day } from '../logic/day';
import { PRESET_SUBJECTS, workTaskTitle, type Subject, type Work, type WorkStatus } from '../logic/study';
import type { Task } from '../logic/tasks';
import type { WeekReview } from '../logic/review';

const subjects = (db: Dexie) => db.table<Subject, number>('subjects');
const works = (db: Dexie) => db.table<Work, number>('works');
const tasks = (db: Dexie) => db.table<Task, number>('tasks');
const reviews = (db: Dexie) => db.table<WeekReview, string>('reviews');
const meta = (db: Dexie) => db.table<{ key: string; value: unknown }, string>('meta');

const now = () => new Date().toISOString();

/** Adds the subject list from the requirements once (meta 'studySeeded'). */
export async function ensureStudySeed(db: Dexie): Promise<void> {
  await db.transaction('rw', subjects(db), works(db), meta(db), async () => {
    if (await meta(db).get('studySeeded')) return;
    await meta(db).put({ key: 'studySeeded', value: now() });
    if (await subjects(db).count()) return;
    let order = 0;
    for (const p of PRESET_SUBJECTS) {
      const id = await subjects(db).add({ name: p.name, semester: p.semester, order: order++, createdAt: now() });
      let k = 0;
      for (const w of p.works ?? []) {
        await works(db).add({ subjectId: id, kind: w.kind, title: w.title, status: 'todo', order: k++, createdAt: now() });
      }
    }
  });
}

export async function listSubjects(db: Dexie): Promise<Subject[]> {
  return (await subjects(db).toArray()).sort((a, b) => a.order - b.order);
}

export async function saveSubject(db: Dexie, s: Subject): Promise<number> {
  const order = s.id != null ? s.order : (await subjects(db).toArray()).reduce((m, x) => Math.max(m, x.order), -1) + 1;
  return subjects(db).put({ ...s, name: s.name.trim(), order });
}

/** Deletes a subject with its works; plan tasks made from them stay (they are history). */
export async function deleteSubject(db: Dexie, id: number): Promise<void> {
  await db.transaction('rw', subjects(db), works(db), async () => {
    await works(db).where('subjectId').equals(id).delete();
    await subjects(db).delete(id);
  });
}

export async function moveSubject(db: Dexie, id: number, dir: -1 | 1): Promise<void> {
  await db.transaction('rw', subjects(db), async () => {
    const list = (await subjects(db).toArray()).sort((a, b) => a.order - b.order);
    const i = list.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    await subjects(db).update(list[i].id!, { order: list[j].order });
    await subjects(db).update(list[j].id!, { order: list[i].order });
  });
}

export async function listWorks(db: Dexie): Promise<Work[]> {
  return (await works(db).toArray()).sort((a, b) => a.subjectId - b.subjectId || a.order - b.order);
}

/** `today` stamps passedDay when the work becomes 'passed'; it is cleared if it goes back. */
export async function saveWork(db: Dexie, w: Work, today: Day): Promise<number> {
  let order = w.order;
  if (w.id == null) order = (await works(db).where('subjectId').equals(w.subjectId).toArray()).reduce((m, x) => Math.max(m, x.order), -1) + 1;
  const prev = w.id != null ? await works(db).get(w.id) : undefined;
  const passedDay = w.status === 'passed' ? (prev?.status === 'passed' ? (prev.passedDay ?? today) : today) : undefined;
  return works(db).put({ ...w, title: w.title.trim(), order, passedDay });
}

export async function setWorkStatus(db: Dexie, id: number, status: WorkStatus, today: Day): Promise<void> {
  const w = await works(db).get(id);
  if (w) await saveWork(db, { ...w, status }, today);
}

export async function deleteWork(db: Dexie, id: number): Promise<void> {
  await works(db).delete(id);
}

/** Open plan tasks linked to works, by workId (to show "в плане"). */
export async function plannedWorks(db: Dexie): Promise<Map<number, Task[]>> {
  const rows = await tasks(db).where('workId').above(0).toArray();
  const map = new Map<number, Task[]>();
  for (const t of rows) {
    if (t.status !== 'open' || t.workId == null) continue;
    map.set(t.workId, [...(map.get(t.workId) ?? []), t]);
  }
  return map;
}

/** Turns a work into a study task for a day (once per day; a second tap does nothing). */
export async function workToTask(db: Dexie, w: Work, subjectName: string, day: Day): Promise<'added' | 'exists'> {
  return db.transaction('rw', tasks(db), works(db), async () => {
    const exists = (await tasks(db).where('workId').equals(w.id!).toArray()).some((t) => t.day === day && t.status !== 'dropped');
    if (exists) return 'exists';
    await tasks(db).add({ title: workTaskTitle(subjectName, w), isMit: false, category: 'study', day, status: 'open', createdAt: now(), workId: w.id });
    if (w.status === 'todo') await works(db).update(w.id!, { status: 'doing' });
    return 'added';
  });
}

export async function worksPassedBetween(db: Dexie, from: Day, to: Day): Promise<Work[]> {
  return (await works(db).where('status').equals('passed').toArray()).filter((w) => w.passedDay && w.passedDay >= from && w.passedDay <= to);
}

// ---------- weekly review ----------

export async function getReview(db: Dexie, week: Day): Promise<WeekReview | undefined> {
  return reviews(db).get(week);
}

export async function saveReview(db: Dexie, r: WeekReview): Promise<void> {
  await reviews(db).put({ ...r, updatedAt: now() });
}

export async function tasksBetween(db: Dexie, from: Day, to: Day): Promise<Task[]> {
  return tasks(db).where('day').between(from, to, true, true).toArray();
}
