import { addDays, type Day } from './day';
import type { Task } from './tasks';

/** Weekly review (meta row per week, keyed by Monday). */
export interface WeekReview {
  week: Day;
  goals: string[];
  worked: string;
  didnt: string;
  updatedAt: string;
}

export const emptyReview = (week: Day): WeekReview => ({ week, goals: ['', '', ''], worked: '', didnt: '', updatedAt: '' });

export const weekEnd = (week: Day): Day => addDays(week, 6);

export interface TaskWeekStats {
  done: number;
  /** Done tasks that had been carried over at least once. */
  doneCarried: number;
  /** Still open on a day that has passed (or today). */
  open: number;
  /** Open tasks that already were carried at least once. */
  openCarried: number;
  studyDone: number;
}

/** Tasks whose day is in the week; `today` limits "open" to days that already came. */
export function taskWeekStats(tasks: Task[], today: Day): TaskWeekStats {
  const s = { done: 0, doneCarried: 0, open: 0, openCarried: 0, studyDone: 0 };
  for (const t of tasks) {
    if (t.status === 'done') {
      s.done++;
      if (t.carriedCount) s.doneCarried++;
      if (t.category === 'study') s.studyDone++;
    } else if (t.status === 'open' && t.day && t.day <= today) {
      s.open++;
      if (t.carriedCount) s.openCarried++;
    }
  }
  return s;
}

/** Sunday, and Monday for the week just ended, are review days. */
export function reviewDue(today: Day, weekdayIdx: number): { due: boolean; week: Day } {
  if (weekdayIdx === 6) return { due: true, week: addDays(today, -6) };
  if (weekdayIdx === 0) return { due: true, week: addDays(today, -7) };
  return { due: false, week: addDays(today, -weekdayIdx) };
}
