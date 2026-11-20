import { addDays, type Day } from './day';

/** Energy and macros. Per 100 g for foods, absolute for log entries and totals. */
export interface Macros {
  kcal: number;
  p: number;
  f: number;
  c: number;
}

export const ZERO: Macros = { kcal: 0, p: 0, f: 0, c: 0 };

export interface Food {
  id?: number;
  name: string;
  per100: Macros;
  /** Optional default portion, e.g. "1 яйцо" = 55 g. */
  portionName?: string;
  portionG?: number;
  favorite: boolean;
  useCount: number;
  lastUsedAt?: string;
  lastGrams?: number;
  createdAt: string;
}

/** Dish items keep their own copy of the values, so a dish never breaks when a food changes. */
export interface DishItem {
  foodId?: number;
  name: string;
  grams: number;
  per100: Macros;
}

export interface Dish {
  id?: number;
  name: string;
  items: DishItem[];
  favorite: boolean;
  useCount: number;
  lastUsedAt?: string;
  createdAt: string;
}

/**
 * One line of the food diary. `total` is what counts; `grams` + `per100` are kept when
 * known so the amount can be edited later. Manual entries have only `total`.
 */
export interface FoodEntry {
  id?: number;
  day: Day;
  meal: string;
  name: string;
  grams?: number;
  per100?: Macros;
  total: Macros;
  foodId?: number;
  dishId?: number;
  createdAt: string;
}

export interface NutritionGoal {
  id?: number;
  /** Effective from this day until the next goal. */
  from: Day;
  kcal: number;
  p: number;
  f: number;
  c: number;
  source: 'calc' | 'manual';
  createdAt: string;
}

export const DEFAULT_MEALS = ['Завтрак', 'Обед', 'Ужин', 'Перекус'];

const r1 = (n: number) => Math.round(n * 10) / 10;

export function forGrams(per100: Macros, grams: number): Macros {
  const k = grams / 100;
  return { kcal: Math.round(per100.kcal * k), p: r1(per100.p * k), f: r1(per100.f * k), c: r1(per100.c * k) };
}

export function addMacros(a: Macros, b: Macros): Macros {
  return { kcal: a.kcal + b.kcal, p: r1(a.p + b.p), f: r1(a.f + b.f), c: r1(a.c + b.c) };
}

export function sumMacros(list: Macros[]): Macros {
  return list.reduce(addMacros, ZERO);
}

/** A dish as one food: total weight and values per 100 g of the whole dish. */
export function dishAsFood(items: DishItem[]): { grams: number; per100: Macros; total: Macros } {
  const grams = items.reduce((s, i) => s + i.grams, 0);
  const total = sumMacros(items.map((i) => forGrams(i.per100, i.grams)));
  const per100 =
    grams > 0
      ? { kcal: (total.kcal * 100) / grams, p: (total.p * 100) / grams, f: (total.f * 100) / grams, c: (total.c * 100) / grams }
      : ZERO;
  return { grams, per100, total };
}

/** "12,5" / "12.5" / " 12 " → number ≥ 0; '' or junk → null. */
export function parseNum(text: string | number | undefined | null): number | null {
  if (text == null) return null;
  const s = String(text).trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function goalForDay(goals: NutritionGoal[], day: Day): NutritionGoal | undefined {
  let best: NutritionGoal | undefined;
  for (const g of goals) if (g.from <= day && (!best || g.from > best.from || (g.from === best.from && g.createdAt > best.createdAt))) best = g;
  return best;
}

export interface DaySummary {
  day: Day;
  total: Macros;
  meals: number;
  entries: number;
}

export interface PeriodSummary {
  days: DaySummary[];
  /** Days with at least one entry. */
  filledDays: number;
  /** Distinct (day, meal) pairs with entries. */
  meals: number;
  /** Average per filled day; null if nothing recorded. */
  avg: Macros | null;
}

/** Summary for every day in [from, to]; averages only over filled days. */
export function periodSummary(entries: FoodEntry[], from: Day, to: Day): PeriodSummary {
  const byDay = new Map<Day, FoodEntry[]>();
  for (const e of entries) if (e.day >= from && e.day <= to) (byDay.get(e.day) ?? byDay.set(e.day, []).get(e.day)!).push(e);
  const days: DaySummary[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const list = byDay.get(d) ?? [];
    days.push({ day: d, total: sumMacros(list.map((e) => e.total)), meals: new Set(list.map((e) => e.meal)).size, entries: list.length });
  }
  const filled = days.filter((d) => d.entries > 0);
  const sum = sumMacros(filled.map((d) => d.total));
  const n = filled.length;
  return {
    days,
    filledDays: n,
    meals: filled.reduce((s, d) => s + d.meals, 0),
    avg: n ? { kcal: Math.round(sum.kcal / n), p: r1(sum.p / n), f: r1(sum.f / n), c: r1(sum.c / n) } : null,
  };
}

/** Honest caveats about an observation window. Never blocks anything. */
export function observationWarnings(s: PeriodSummary, windowDays = 7): string[] {
  const w: string[] = [];
  if (s.filledDays === 0) return ['Нет записей за этот период: считать не из чего.'];
  if (s.filledDays < windowDays - 2)
    w.push(
      `Заполнено ${s.filledDays} из ${windowDays} дней. Если в незаписанные дни ты ел больше обычного, среднее занижено и «+%» может не дать набор.`,
    );
  if (s.meals / s.filledDays < 2.5)
    w.push('В среднем меньше трёх приёмов пищи в заполненный день. Похоже, часть еды не записана, тогда среднее занижено.');
  return w;
}

export type Sex = 'm' | 'f';
export type NutritionGoalKind = 'gain' | 'maintain' | 'cut';

export const ACTIVITY_LEVELS = [
  { value: 1.2, label: 'Минимальная: сидячий день, без тренировок' },
  { value: 1.375, label: 'Лёгкая: 1–3 тренировки в неделю' },
  { value: 1.55, label: 'Средняя: 3–5 тренировок в неделю' },
  { value: 1.725, label: 'Высокая: 6–7 тренировок в неделю' },
] as const;

export const GOAL_KINDS: Record<NutritionGoalKind, { label: string; adj: number }> = {
  gain: { label: 'Набор', adj: 0.1 },
  maintain: { label: 'Удержание', adj: 0 },
  cut: { label: 'Сушка', adj: -0.15 },
};

export interface Profile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
}

/** Mifflin–St Jeor basal metabolic rate, kcal/day. */
export function mifflin(p: Profile): number {
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'm' ? 5 : -161);
}

const round10 = (n: number) => Math.round(n / 10) * 10;

/**
 * Estimate only: BMR × activity, adjusted for the goal. Protein 1.8 g/kg (2.0 on a cut),
 * fat 0.9 g/kg, the rest carbs.
 */
export function estimateTargets(
  p: Profile,
  activity: number,
  goal: NutritionGoalKind,
): { bmr: number; tdee: number; target: Macros } {
  const bmr = mifflin(p);
  const tdee = bmr * activity;
  const kcal = round10(tdee * (1 + GOAL_KINDS[goal].adj));
  const prot = Math.round(p.weightKg * (goal === 'cut' ? 2 : 1.8));
  const fat = Math.round(p.weightKg * 0.9);
  const carb = Math.max(0, Math.round((kcal - prot * 4 - fat * 9) / 4));
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), target: { kcal, p: prot, f: fat, c: carb } };
}

/** Observed average + pct % for every value. */
export function suggestFromAverage(avg: Macros, pct: number): Macros {
  const k = 1 + pct / 100;
  return { kcal: round10(avg.kcal * k), p: Math.round(avg.p * k), f: Math.round(avg.f * k), c: Math.round(avg.c * k) };
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').trim();

interface Searchable {
  name: string;
  favorite: boolean;
  useCount: number;
  lastUsedAt?: string;
  createdAt?: string;
}

/** Name contains the query (case/ё-insensitive); prefix matches first, then favorites, then most used. */
export function searchByName<T extends Searchable>(items: T[], query: string): T[] {
  const q = norm(query);
  if (!q) return [];
  const hits = items.filter((i) => norm(i.name).includes(q));
  const score = (i: T) => (norm(i.name).startsWith(q) ? 2 : 0) + (i.favorite ? 1 : 0);
  return hits.sort((a, b) => score(b) - score(a) || b.useCount - a.useCount || a.name.localeCompare(b.name, 'ru'));
}

/** For an empty search: favorites first, then recently used or created (up to `limit` in total). */
export function quickPicks<T extends Searchable>(items: T[], limit = 12): T[] {
  const fav = items.filter((i) => i.favorite).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const at = (i: T) => i.lastUsedAt ?? i.createdAt ?? '';
  const recent = items.filter((i) => !i.favorite && at(i)).sort((a, b) => (at(b) > at(a) ? 1 : -1));
  return [...fav, ...recent].slice(0, limit);
}

export type NewFood = Pick<Food, 'name' | 'per100' | 'portionName' | 'portionG'>;

/**
 * CSV import: name; kcal; protein; fat; carbs[; portion name; portion grams] per 100 g.
 * Delimiter ';', tab or ',' (with ',' decimals must use '.'). A header row is skipped.
 */
export function parseFoodCsv(text: string): { foods: NewFood[]; errors: string[] } {
  const foods: NewFood[] = [];
  const errors: string[] = [];
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  let first = true;
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const isFirst = first;
    first = false;
    const delim = line.includes(';') ? ';' : line.includes('\t') ? '\t' : ',';
    const cols = line.split(delim).map((c) => c.trim().replace(/^"(.*)"$/, '$1'));
    const [name, kcal, p, f, c, portionName, portionG] = cols;
    const nums = [kcal, p, f, c].map(parseNum);
    if (nums.some((n) => n == null) || !name) {
      if (isFirst && parseNum(kcal) == null) return; // header row
      errors.push(`Строка ${i + 1}: нужно «название; ккал; белки; жиры; углеводы»`);
      return;
    }
    const pg = parseNum(portionG);
    foods.push({
      name,
      per100: { kcal: nums[0]!, p: nums[1]!, f: nums[2]!, c: nums[3]! },
      ...(portionName && pg ? { portionName, portionG: pg } : {}),
    });
  });
  return { foods, errors };
}

/** 12.3 → "12,3"; at most one decimal. */
export function fmt1(n: number): string {
  return String(Math.round(n * 10) / 10).replace('.', ',');
}

/** Values for a progress bar: share of goal (capped at 1) and a neutral "left / over" label. */
export function progress(value: number, goal: number, unit: string): { share: number; label: string } {
  if (!goal) return { share: 0, label: '' };
  const left = Math.round(goal - value);
  return {
    share: Math.min(1, Math.max(0, value / goal)),
    label: left >= 0 ? `осталось ${left} ${unit}` : `+${-left} ${unit} сверх цели`,
  };
}
