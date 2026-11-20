/** Calendar day as 'YYYY-MM-DD'. All day math is done on these strings via UTC. */
export type Day = string;

export const TZ = 'Asia/Novosibirsk';
export const DEFAULT_DAY_START_HOUR = 4;

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    fmtCache.set(tz, f);
  }
  return f;
}

/** Calendar date of an instant in the given time zone. */
export function calendarDay(at: Date, tz = TZ): Day {
  const p = partsFormatter(tz).formatToParts(at);
  const get = (t: string) => p.find((x) => x.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * "Logical" day: the day ends at `dayStartHour` local time, so 01:30 still belongs
 * to the previous day. Asia/Novosibirsk has no DST, so a fixed shift is exact.
 */
export function logicalDay(at: Date, dayStartHour = DEFAULT_DAY_START_HOUR, tz = TZ): Day {
  return calendarDay(new Date(at.getTime() - dayStartHour * 3_600_000), tz);
}

function toUtc(day: Day): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): Day {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(day: Day, n: number): Day {
  return fromUtc(toUtc(day) + n * 86_400_000);
}

/** b − a in whole days. */
export function diffDays(a: Day, b: Day): number {
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** 0 = Monday … 6 = Sunday. */
export function weekday(day: Day): number {
  return (new Date(toUtc(day)).getUTCDay() + 6) % 7;
}

/** Monday of the week containing `day`. */
export function weekStart(day: Day): Day {
  return addDays(day, -weekday(day));
}

export function dayRange(from: Day, to: Day): Day[] {
  const out: Day[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

const longFmt = new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'long' });
const shortFmt = new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', day: 'numeric', month: 'short' });

/** "вс, 8 ноября" */
export function formatDayLong(day: Day): string {
  return longFmt.format(new Date(toUtc(day)));
}

/** "8 нояб." */
export function formatDayShort(day: Day): string {
  return shortFmt.format(new Date(toUtc(day)));
}

/** "Сегодня" / "Вчера" / "Завтра" / "вс, 8 ноября" */
export function relativeDayLabel(day: Day, today: Day): string {
  const d = diffDays(today, day);
  if (d === 0) return 'Сегодня';
  if (d === -1) return 'Вчера';
  if (d === 1) return 'Завтра';
  return formatDayLong(day);
}

export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
