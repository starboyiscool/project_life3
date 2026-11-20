import { addDays, diffDays, type Day } from './day';

export interface WeightPoint {
  day: Day;
  kg: number;
}

export interface AvgPoint {
  day: Day;
  avg: number;
}

/**
 * Trailing moving average over a calendar window: for every entry day d,
 * the mean of all entries with day in (d − window, d]. Missing days are simply absent.
 */
export function movingAverage(entries: WeightPoint[], window = 7): AvgPoint[] {
  const sorted = [...entries].sort((a, b) => (a.day < b.day ? -1 : 1));
  const out: AvgPoint[] = [];
  let lo = 0;
  let sum = 0;
  for (let hi = 0; hi < sorted.length; hi++) {
    sum += sorted[hi].kg;
    const from = addDays(sorted[hi].day, -(window - 1));
    while (sorted[lo].day < from) sum -= sorted[lo++].kg;
    out.push({ day: sorted[hi].day, avg: sum / (hi - lo + 1) });
  }
  return out;
}

/**
 * Weekly change of the trend: moving average at the latest entry vs. the latest
 * point at least 7 days earlier, scaled to kg per 7 days. null if not enough data.
 */
export function weeklyTrend(entries: WeightPoint[], window = 7): number | null {
  const ma = movingAverage(entries, window);
  if (ma.length < 2) return null;
  const last = ma[ma.length - 1];
  const cutoff = addDays(last.day, -7);
  let prev: AvgPoint | undefined;
  for (let i = ma.length - 2; i >= 0; i--) {
    if (ma[i].day <= cutoff) {
      prev = ma[i];
      break;
    }
  }
  if (!prev) return null;
  return ((last.avg - prev.avg) * 7) / diffDays(prev.day, last.day);
}

/** Parses "71,4" / "71.4" → 71.4; null if not a sane body weight. */
export function parseKg(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 20 || n > 300) return null;
  return Math.round(n * 10) / 10;
}

export function formatKg(n: number, digits = 1): string {
  return n.toFixed(digits).replace('.', ',');
}

export function formatSigned(n: number, digits = 1): string {
  const s = formatKg(Math.abs(n), digits);
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : s;
}
