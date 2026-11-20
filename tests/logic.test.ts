import { describe, expect, it } from 'vitest';
import { addDays, diffDays, logicalDay, weekday, weekStart, relativeDayLabel } from '../src/lib/logic/day';
import { ruleMatches, describeRule } from '../src/lib/logic/recurrence';
import { dailyStreak, mitStreak, weekProgress, weeklyStreak } from '../src/lib/logic/streaks';
import { movingAverage, parseKg, weeklyTrend, formatSigned } from '../src/lib/logic/weight';
import { sortTasks, totalMinutes, type Task } from '../src/lib/logic/tasks';

// Novosibirsk = UTC+7
const nsk = (iso: string) => new Date(`${iso}+07:00`);

describe('day boundary (04:00, Asia/Novosibirsk)', () => {
  it('before 04:00 still belongs to the previous day', () => {
    expect(logicalDay(nsk('2026-11-09T03:59'))).toBe('2026-11-08');
    expect(logicalDay(nsk('2026-11-09T04:00'))).toBe('2026-11-09');
    expect(logicalDay(nsk('2026-11-08T23:30'))).toBe('2026-11-08');
  });

  it('respects a custom day start hour', () => {
    expect(logicalDay(nsk('2026-11-09T01:00'), 0)).toBe('2026-11-09');
    expect(logicalDay(nsk('2026-11-09T05:30'), 6)).toBe('2026-11-08');
  });

  it('does not depend on the machine time zone', () => {
    // 2026-11-08 21:00 UTC = 2026-11-09 04:00 NSK
    expect(logicalDay(new Date(Date.UTC(2026, 10, 8, 21, 0)))).toBe('2026-11-09');
  });

  it('day arithmetic across months and years', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffDays('2026-11-08', '2026-12-31')).toBe(53);
  });

  it('weeks start on Monday', () => {
    expect(weekday('2026-11-08')).toBe(6); // Sunday
    expect(weekday('2026-11-09')).toBe(0); // Monday
    expect(weekStart('2026-11-08')).toBe('2026-11-02');
    expect(weekStart('2026-11-09')).toBe('2026-11-09');
  });

  it('relative labels', () => {
    expect(relativeDayLabel('2026-11-09', '2026-11-08')).toBe('Завтра');
    expect(relativeDayLabel('2026-11-07', '2026-11-08')).toBe('Вчера');
  });
});

describe('recurrence', () => {
  it('daily, weekdays, interval', () => {
    expect(ruleMatches({ type: 'daily' }, '2026-11-08', '2026-11-20')).toBe(true);
    expect(ruleMatches({ type: 'daily' }, '2026-11-08', '2026-11-07')).toBe(false);
    expect(ruleMatches({ type: 'weekdays', days: [0, 2, 4] }, '2026-11-01', '2026-11-09')).toBe(true); // Mon
    expect(ruleMatches({ type: 'weekdays', days: [0, 2, 4] }, '2026-11-01', '2026-11-10')).toBe(false); // Tue
    expect(ruleMatches({ type: 'interval', every: 2 }, '2026-11-08', '2026-11-10')).toBe(true);
    expect(ruleMatches({ type: 'interval', every: 2 }, '2026-11-08', '2026-11-11')).toBe(false);
  });

  it('describes rules', () => {
    expect(describeRule({ type: 'interval', every: 2 })).toBe('через день');
    expect(describeRule({ type: 'weekdays', days: [4, 0] })).toBe('Пн, Пт');
  });
});

describe('MIT streak', () => {
  const s = (mit: number, mitDone: number) => ({ mit, mitDone });

  it('counts consecutive successful days, skipping days without MITs', () => {
    const stats = {
      '2026-11-03': s(2, 2),
      '2026-11-04': s(3, 1), // fail
      '2026-11-05': s(1, 1),
      '2026-11-06': s(0, 0), // neutral
      '2026-11-07': s(2, 2),
    };
    expect(mitStreak(stats, '2026-11-07')).toEqual({ current: 2, best: 2 });
  });

  it('today in progress does not break the streak', () => {
    const stats = { '2026-11-06': s(1, 1), '2026-11-07': s(2, 2), '2026-11-08': s(3, 0) };
    expect(mitStreak(stats, '2026-11-08')).toEqual({ current: 2, best: 2 });
    stats['2026-11-08'] = s(3, 3);
    expect(mitStreak(stats, '2026-11-08')).toEqual({ current: 3, best: 3 });
  });

  it('a day with no record at all is neutral (a skipped day is just a skip)', () => {
    const stats = { '2026-11-05': s(1, 1), '2026-11-07': s(1, 1) };
    expect(mitStreak(stats, '2026-11-07').current).toBe(2);
  });

  it('empty', () => {
    expect(mitStreak({}, '2026-11-08')).toEqual({ current: 0, best: 0 });
  });
});

describe('habit streaks', () => {
  it('daily: today not done yet keeps yesterday’s streak', () => {
    const done = new Set(['2026-11-05', '2026-11-06', '2026-11-07']);
    expect(dailyStreak(done, '2026-11-08', '2026-11-01')).toEqual({ current: 3, best: 3 });
    done.add('2026-11-08');
    expect(dailyStreak(done, '2026-11-08', '2026-11-01').current).toBe(4);
  });

  it('daily: best is the longest run', () => {
    const done = new Set(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-05', '2026-11-08']);
    expect(dailyStreak(done, '2026-11-08', '2026-11-01')).toEqual({ current: 1, best: 3 });
  });

  it('weekly: counts weeks meeting the target, current week counts once met', () => {
    // weeks: Oct 26, Nov 2 (met 3x), Nov 9 (in progress)
    const done = new Set(['2026-10-26', '2026-10-28', '2026-10-30', '2026-11-02', '2026-11-04', '2026-11-06', '2026-11-09']);
    expect(weeklyStreak(done, 3, '2026-11-10')).toEqual({ current: 2, best: 2 });
    done.add('2026-11-10');
    done.add('2026-11-11');
    expect(weeklyStreak(done, 3, '2026-11-11')).toEqual({ current: 3, best: 3 });
  });

  it('week progress', () => {
    const done = new Set(['2026-11-09', '2026-11-10']);
    // Wednesday: 2 of 3 elapsed days
    expect(weekProgress(done, '2026-11-11', { type: 'daily' }, '2026-01-01')).toEqual({ done: 2, target: 3, ratio: 2 / 3 });
    expect(weekProgress(done, '2026-11-11', { type: 'weekly', times: 3 }, '2026-01-01').ratio).toBeCloseTo(2 / 3);
    // habit created on Tuesday: only 2 elapsed days count
    expect(weekProgress(done, '2026-11-11', { type: 'daily' }, '2026-11-10').target).toBe(2);
  });
});

describe('weight', () => {
  it('moving average uses a calendar window and tolerates gaps', () => {
    const ma = movingAverage([
      { day: '2026-11-01', kg: 70 },
      { day: '2026-11-02', kg: 72 },
      { day: '2026-11-08', kg: 74 }, // window (11-02..11-08]
      { day: '2026-11-09', kg: 76 }, // window 11-03..11-09 → 74, 76
    ]);
    expect(ma.map((p) => p.avg)).toEqual([70, 71, 73, 75]);
  });

  it('weekly trend in kg per 7 days', () => {
    const entries = Array.from({ length: 21 }, (_, i) => ({ day: addDays('2026-11-01', i), kg: 70 + i * 0.05 }));
    expect(weeklyTrend(entries)).toBeCloseTo(0.35, 5);
    expect(weeklyTrend(entries.slice(0, 5))).toBeNull();
  });

  it('parses kg input', () => {
    expect(parseKg('71,44')).toBe(71.4);
    expect(parseKg(' 70.05 ')).toBe(70.1);
    expect(parseKg('7')).toBeNull();
    expect(parseKg('abc')).toBeNull();
  });

  it('formats signed values', () => {
    expect(formatSigned(0.25)).toBe('+0,3');
    expect(formatSigned(-0.2)).toBe('−0,2');
  });
});

describe('task sorting', () => {
  const t = (title: string, p: Partial<Task>): Task => ({
    title,
    isMit: false,
    category: 'other',
    day: '2026-11-08',
    status: 'open',
    createdAt: '2026-11-08T00:00:00Z',
    ...p,
  });

  it('MIT first, then study, then by time, then creation', () => {
    const sorted = sortTasks([
      t('a', { createdAt: '2026-11-08T00:00:01Z' }),
      t('b', { category: 'study' }),
      t('c', { isMit: true }),
      t('d', { timeStart: '10:00' }),
      t('e', { isMit: true, category: 'study' }),
    ]);
    expect(sorted.map((x) => x.title)).toEqual(['e', 'c', 'b', 'd', 'a']);
  });

  it('totalMinutes sums estimates and ignores unestimated tasks', () => {
    expect(totalMinutes([t('a', {}), t('b', { estimateMin: 30 }), t('c', { estimateMin: 90 })])).toBe(120);
    expect(totalMinutes([])).toBe(0);
  });
});
