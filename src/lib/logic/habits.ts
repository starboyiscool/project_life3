import type { Day } from './day';

export type HabitSchedule = { type: 'daily' } | { type: 'weekly'; times: number };

export interface Habit {
  id?: number;
  name: string;
  schedule: HabitSchedule;
  order: number;
  archived: boolean;
  startDay: Day;
  createdAt: string;
}

export interface HabitLog {
  habitId: number;
  day: Day;
}

export function describeSchedule(s: HabitSchedule): string {
  return s.type === 'daily' ? 'каждый день' : `${s.times} раз(а) в неделю`;
}
