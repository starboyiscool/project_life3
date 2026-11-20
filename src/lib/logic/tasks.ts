import type { Day } from './day';
import type { RepeatRule } from './recurrence';

export type Category = 'study' | 'training' | 'home' | 'project' | 'other';

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'study', label: 'Учёба' },
  { id: 'training', label: 'Тренировка' },
  { id: 'home', label: 'Быт' },
  { id: 'project', label: 'Проект' },
  { id: 'other', label: 'Другое' },
];

export const categoryLabel = (c: Category) => CATEGORIES.find((x) => x.id === c)?.label ?? c;

export const MAX_MIT = 3;

/** open/done/dropped tasks have a day; backlog tasks have day ''. dropped = skipped recurring instance. */
export type TaskStatus = 'open' | 'done' | 'backlog' | 'dropped';

export interface Task {
  id?: number;
  title: string;
  isMit: boolean;
  category: Category;
  estimateMin?: number;
  timeStart?: string; // 'HH:MM'
  timeEnd?: string; // 'HH:MM'
  day: Day | '';
  status: TaskStatus;
  createdAt: string;
  doneAt?: string;
  recurringId?: number;
  carriedCount?: number;
  /** Plan task made from a study work (Phase 4). */
  workId?: number;
}

export interface RecurringTask {
  id?: number;
  title: string;
  isMit: boolean;
  category: Category;
  estimateMin?: number;
  timeStart?: string;
  rule: RepeatRule;
  startDay: Day;
  active: boolean;
  createdAt: string;
}

/** MIT first, then study above other categories, then by time block, then creation order. */
export function sortTasks<T extends Task>(tasks: T[]): T[] {
  return [...tasks].sort(
    (a, b) =>
      Number(b.isMit) - Number(a.isMit) ||
      Number(b.category === 'study') - Number(a.category === 'study') ||
      (a.timeStart ?? '99:99').localeCompare(b.timeStart ?? '99:99') ||
      a.createdAt.localeCompare(b.createdAt),
  );
}

export function formatEstimate(min?: number): string {
  if (!min) return '';
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

/** Total planned minutes (estimateMin) across the given tasks. */
export function totalMinutes<T extends Task>(tasks: T[]): number {
  return tasks.reduce((a, t) => a + (t.estimateMin ?? 0), 0);
}
