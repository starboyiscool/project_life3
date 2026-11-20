import { diffDays, weekday, WEEKDAYS_SHORT, type Day } from './day';

export type RepeatRule =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] } // 0 = Mon … 6 = Sun
  | { type: 'interval'; every: number }; // every N days starting from startDay

export function ruleMatches(rule: RepeatRule, startDay: Day, day: Day): boolean {
  if (day < startDay) return false;
  switch (rule.type) {
    case 'daily':
      return true;
    case 'weekdays':
      return rule.days.includes(weekday(day));
    case 'interval':
      return rule.every >= 1 && diffDays(startDay, day) % rule.every === 0;
  }
}

export function describeRule(rule: RepeatRule): string {
  switch (rule.type) {
    case 'daily':
      return 'каждый день';
    case 'weekdays':
      return [...rule.days]
        .sort((a, b) => a - b)
        .map((d) => WEEKDAYS_SHORT[d])
        .join(', ');
    case 'interval':
      return rule.every === 1 ? 'каждый день' : rule.every === 2 ? 'через день' : `раз в ${rule.every} дн.`;
  }
}
