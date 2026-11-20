import { addDays, diffDays, type Day } from './day';
import type { Subject, Work } from './study';

export function semesterWeek(start: Day | undefined, day: Day): number | null {
  if (!start) return null;
  const delta = diffDays(start, day);
  if (delta < 0 || delta >= 52 * 7) return null;
  return Math.floor(delta / 7) + 1;
}
export function semesterWeekRange(start: Day | undefined, week: number | undefined): { from: Day; to: Day } | null {
  if (!start || !week || !Number.isInteger(week) || week < 1 || week > 52) return null;
  const from = addDays(start, (week - 1) * 7);
  return { from, to: addDays(from, 6) };
}
/** A week number is only mapped for a subject in the selected semester. */
export function workWeekRange(work: Work, subject: Subject | undefined, semesterNumber: number | undefined, start: Day | undefined) {
  if (!subject || !semesterNumber || subject.semester !== semesterNumber) return null;
  return semesterWeekRange(start, work.deadlineWeek);
}
export const isControlWeek = (week: number | null) => week === 7 || week === 14;
