import type { Transaction } from 'dexie';

/**
 * Schema history. Rules:
 * - Never edit or delete an entry that has shipped; add a new one with version + 1.
 * - `stores` lists only tables that change in that version (Dexie keeps the rest);
 *   `null` deletes a table.
 * - Every table uses an inbound primary key (a property of the row, e.g. `id` or `++id`),
 *   so a plain row dump is a complete backup.
 * - `upgrade` transforms existing rows; it runs inside the version-change transaction,
 *   after an automatic pre-migration snapshot has been saved (see database.ts).
 */
export interface Migration {
  version: number;
  stores: Record<string, string | null>;
  upgrade?: (tx: Transaction) => PromiseLike<unknown> | void;
}

export const migrations: Migration[] = [
  {
    version: 1,
    stores: {
      // key-value: app settings and service values (e.g. lastExportAt)
      meta: 'key',
    },
  },
  {
    // Phase 1: day plan, recurring tasks, habits, body weight
    version: 2,
    stores: {
      tasks: '++id, day, status, doneAt, [recurringId+day]',
      recurring: '++id',
      habits: '++id',
      habitLogs: '[habitId+day], day',
      weights: 'day',
    },
  },
  {
    // Phase 2: nutrition. Log entries keep a snapshot of the food's values,
    // so editing or deleting a food never rewrites history.
    version: 3,
    stores: {
      foods: '++id, name',
      dishes: '++id, name',
      foodLog: '++id, day, [day+meal]',
      nutritionGoals: '++id, from',
    },
  },
  {
    // Phase 3: gym. Sets live inside the workout row (items[].sets).
    version: 4,
    stores: {
      exercises: '++id, name',
      workoutTemplates: '++id',
      workouts: '++id, day, status',
    },
  },
  {
    // Phase 4: study debts and the weekly review. tasks.workId links a plan task to a work.
    version: 5,
    stores: {
      subjects: '++id',
      works: '++id, subjectId, status',
      reviews: 'week',
      tasks: '++id, day, status, doneAt, [recurringId+day], workId',
    },
  },
];

export const SCHEMA_VERSION = latestVersion(migrations);

export function latestVersion(list: Migration[]): number {
  return list.reduce((max, m) => Math.max(max, m.version), 0);
}
