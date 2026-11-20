import { addDays, weekStart, type Day } from './day';

/**
 * Streaks never punish: days with nothing scheduled are neutral (skipped),
 * and the current day/week only counts once it succeeds — it never breaks a streak
 * while it is still in progress.
 */

export interface MitDayStat {
  mit: number;
  mitDone: number;
}

export interface StreakResult {
  current: number;
  best: number;
}

const mitSuccess = (s?: MitDayStat) => !!s && s.mit > 0 && s.mitDone >= s.mit;
const mitFail = (s?: MitDayStat) => !!s && s.mit > 0 && s.mitDone < s.mit;

/** Streak of days on which all MITs were done. Days without MITs are neutral. */
export function mitStreak(stats: Record<Day, MitDayStat>, today: Day): StreakResult {
  const days = Object.keys(stats).filter((d) => d <= today).sort();
  if (!days.length) return { current: 0, best: 0 };

  let current = 0;
  for (let d = today; d >= days[0]; d = addDays(d, -1)) {
    const s = stats[d];
    if (mitSuccess(s)) current++;
    else if (mitFail(s) && d !== today) break;
  }

  let best = 0;
  let run = 0;
  for (const d of days) {
    const s = stats[d];
    if (mitSuccess(s)) best = Math.max(best, ++run);
    else if (mitFail(s) && d !== today) run = 0;
  }
  return { current, best };
}

/** Daily habit: consecutive done days; today not done yet does not break it. */
export function dailyStreak(doneDays: Set<Day>, today: Day, startDay: Day): StreakResult {
  let current = 0;
  let d = doneDays.has(today) ? today : addDays(today, -1);
  while (d >= startDay && doneDays.has(d)) {
    current++;
    d = addDays(d, -1);
  }

  let best = 0;
  let run = 0;
  let prev: Day | null = null;
  for (const day of [...doneDays].filter((x) => x <= today).sort()) {
    run = prev !== null && addDays(prev, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return { current, best };
}

/** "N times a week" habit: consecutive weeks (Mon–Sun) meeting the target; the current week counts once met. */
export function weeklyStreak(doneDays: Set<Day>, timesPerWeek: number, today: Day): StreakResult {
  const perWeek = new Map<Day, number>();
  for (const d of doneDays) {
    if (d > today) continue;
    const w = weekStart(d);
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
  }
  const met = (w: Day) => (perWeek.get(w) ?? 0) >= timesPerWeek;
  const thisWeek = weekStart(today);
  const earliest = [...perWeek.keys()].sort()[0];
  if (!earliest) return { current: 0, best: 0 };

  let current = 0;
  let w = met(thisWeek) ? thisWeek : addDays(thisWeek, -7);
  while (w >= earliest && met(w)) {
    current++;
    w = addDays(w, -7);
  }

  let best = 0;
  let run = 0;
  for (let wk = earliest; wk <= thisWeek; wk = addDays(wk, 7)) {
    if (met(wk)) best = Math.max(best, ++run);
    else if (wk !== thisWeek) run = 0;
  }
  return { current, best };
}

/**
 * Share (0..1) of the current week's target done so far.
 * Daily: done days / days elapsed this week (including today). Weekly: done / target, capped at 1.
 */
export function weekProgress(
  doneDays: Set<Day>,
  today: Day,
  schedule: { type: 'daily' } | { type: 'weekly'; times: number },
  startDay: Day,
): { done: number; target: number; ratio: number } {
  const ws = weekStart(today);
  let done = 0;
  for (const d of doneDays) if (d >= ws && d <= addDays(ws, 6)) done++;
  if (schedule.type === 'weekly') {
    const target = schedule.times;
    return { done, target, ratio: target ? Math.min(1, done / target) : 0 };
  }
  const from = startDay > ws ? startDay : ws;
  let target = 0;
  for (let d = from; d <= today; d = addDays(d, 1)) target++;
  return { done, target, ratio: target ? Math.min(1, done / target) : 0 };
}
