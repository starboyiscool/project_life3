import { ruleMatches } from './recurrence';
import type { Day } from './day';
import type { Category, RecurringTask, Task } from './tasks';
export type CalendarFilter = 'all' | 'study' | 'training' | 'other';
export function matchesFilter(category: Category, filter: CalendarFilter): boolean {
  return filter === 'all' || (filter === 'other' ? category !== 'study' && category !== 'training' : category === filter);
}
/** Visible tasks plus projected future repetitions, never re-adding skipped instances. */
export function calendarCounts(dates: Day[], rows: Task[], rules: RecurringTask[], filter: CalendarFilter = 'all'): Record<string, number> {
  const visible = new Set(dates);
  const counts: Record<string, number> = {};
  const recorded = new Set(rows.filter(t => t.recurringId != null).map(t => `${t.recurringId}:${t.day}`));
  for (const t of rows) if (visible.has(t.day) && matchesFilter(t.category, filter) && (t.status === 'open' || t.status === 'done')) counts[t.day] = (counts[t.day] ?? 0) + 1;
  for (const r of rules) if (r.active && r.id != null && matchesFilter(r.category, filter)) for (const d of dates) {
    if (ruleMatches(r.rule, r.startDay, d) && !recorded.has(`${r.id}:${d}`)) counts[d] = (counts[d] ?? 0) + 1;
  }
  return counts;
}

/** A training card follows real calendar tasks or recorded workouts, not a gym forecast. */
export function hasTrainingOnDay(day: Day, tasks: Task[], workouts: import('./gym').Workout[]): boolean {
  return tasks.some(t => t.day === day && t.category === 'training' && (t.status === 'open' || t.status === 'done')) ||
    workouts.some(w => w.day === day && (w.status === 'active' || w.status === 'done'));
}
