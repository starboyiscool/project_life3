import type Dexie from 'dexie';
import type { Day } from '../logic/day';

export interface WeightEntry {
  day: Day;
  kg: number;
  at: string; // when it was recorded
}

const weights = (db: Dexie) => db.table<WeightEntry, string>('weights');

/** One entry per day; saving again for the same day replaces it. */
export async function saveWeight(db: Dexie, day: Day, kg: number): Promise<void> {
  await weights(db).put({ day, kg, at: new Date().toISOString() });
}

export async function deleteWeight(db: Dexie, day: Day): Promise<void> {
  await weights(db).delete(day);
}

export async function listWeights(db: Dexie): Promise<WeightEntry[]> {
  return weights(db).orderBy('day').toArray();
}

export async function lastWeight(db: Dexie): Promise<WeightEntry | undefined> {
  return weights(db).orderBy('day').last();
}
