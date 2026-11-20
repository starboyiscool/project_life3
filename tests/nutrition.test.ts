import 'fake-indexeddb/auto';
import type Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openAppDb } from '../src/lib/db/database';
import { SnapshotStore } from '../src/lib/db/snapshots';
import {
  dishAsFood,
  estimateTargets,
  forGrams,
  goalForDay,
  mifflin,
  observationWarnings,
  parseFoodCsv,
  parseNum,
  periodSummary,
  progress,
  quickPicks,
  searchByName,
  suggestFromAverage,
  type FoodEntry,
  type NutritionGoal,
} from '../src/lib/logic/nutrition';
import * as N from '../src/lib/repo/nutrition';

const entry = (day: string, meal: string, kcal: number, p = 0, f = 0, c = 0): FoodEntry => ({
  day,
  meal,
  name: 'x',
  total: { kcal, p, f, c },
  createdAt: '',
});

describe('macros math', () => {
  it('scales per 100 g', () => {
    expect(forGrams({ kcal: 343, p: 12.6, f: 3.3, c: 62.1 }, 80)).toEqual({ kcal: 274, p: 10.1, f: 2.6, c: 49.7 });
  });

  it('dish as one food', () => {
    const d = dishAsFood([
      { name: 'овсянка', grams: 60, per100: { kcal: 350, p: 12, f: 6, c: 60 } },
      { name: 'молоко', grams: 200, per100: { kcal: 60, p: 3, f: 3.2, c: 4.7 } },
    ]);
    expect(d.grams).toBe(260);
    expect(d.total).toEqual({ kcal: 330, p: 13.2, f: 10, c: 45.4 });
    expect(Math.round(d.per100.kcal)).toBe(127);
  });

  it('parses numbers with a comma', () => {
    expect(parseNum('12,5')).toBe(12.5);
    expect(parseNum(' 0 ')).toBe(0);
    expect(parseNum('')).toBeNull();
    expect(parseNum('-1')).toBeNull();
    expect(parseNum('abc')).toBeNull();
  });
});

describe('observation and goals', () => {
  it('averages only over filled days and counts meals', () => {
    const s = periodSummary(
      [
        entry('2026-11-01', 'Завтрак', 500, 20),
        entry('2026-11-01', 'Обед', 900, 40),
        entry('2026-11-01', 'Обед', 100, 0),
        entry('2026-11-03', 'Ужин', 1000, 30),
        entry('2026-11-09', 'Ужин', 5000), // outside
      ],
      '2026-11-01',
      '2026-11-07',
    );
    expect(s.days).toHaveLength(7);
    expect(s.filledDays).toBe(2);
    expect(s.meals).toBe(3);
    expect(s.avg).toEqual({ kcal: 1250, p: 45, f: 0, c: 0 });
  });

  it('warns about few days and few meals, never blocks', () => {
    const s = periodSummary([entry('2026-11-01', 'Обед', 2000)], '2026-11-01', '2026-11-07');
    expect(observationWarnings(s)).toHaveLength(2);
    const full = periodSummary(
      ['01', '02', '03', '04', '05', '06', '07'].flatMap((d) =>
        ['Завтрак', 'Обед', 'Ужин'].map((m) => entry(`2026-11-${d}`, m, 800)),
      ),
      '2026-11-01',
      '2026-11-07',
    );
    expect(observationWarnings(full)).toEqual([]);
    expect(observationWarnings(periodSummary([], '2026-11-01', '2026-11-07'))).toHaveLength(1);
  });

  it('suggests average + pct', () => {
    expect(suggestFromAverage({ kcal: 2345, p: 100, f: 70, c: 300 }, 10)).toEqual({ kcal: 2580, p: 110, f: 77, c: 330 });
  });

  it('Mifflin–St Jeor', () => {
    expect(mifflin({ sex: 'm', age: 20, heightCm: 173, weightKg: 71 })).toBeCloseTo(1696.25); // 710 + 1081.25 − 100 + 5
    expect(mifflin({ sex: 'f', age: 20, heightCm: 173, weightKg: 71 })).toBeCloseTo(1530.25);
    const e = estimateTargets({ sex: 'm', age: 20, heightCm: 173, weightKg: 71 }, 1.55, 'gain');
    expect(e.tdee).toBe(2629);
    expect(e.target.kcal).toBe(2890); // 2629.2 × 1.1, to 10
    expect(e.target.p).toBe(128);
    expect(e.target.f).toBe(64);
    expect(e.target.c).toBe(Math.round((2890 - 128 * 4 - 64 * 9) / 4));
  });

  it('picks the goal in effect on a day', () => {
    const g = (from: string, kcal: number, createdAt = ''): NutritionGoal => ({ from, kcal, p: 0, f: 0, c: 0, source: 'manual', createdAt });
    const list = [g('2026-11-15', 2600), g('2026-11-22', 2800), g('2026-11-22', 2900, 'z')];
    expect(goalForDay(list, '2026-11-14')).toBeUndefined();
    expect(goalForDay(list, '2026-11-20')!.kcal).toBe(2600);
    expect(goalForDay(list, '2026-11-30')!.kcal).toBe(2900);
  });

  it('progress is neutral both ways', () => {
    expect(progress(1500, 2500, 'ккал')).toEqual({ share: 0.6, label: 'осталось 1000 ккал' });
    expect(progress(2700, 2500, 'ккал')).toEqual({ share: 1, label: '+200 ккал сверх цели' });
  });
});

describe('search and CSV', () => {
  const item = (name: string, favorite = false, useCount = 0, lastUsedAt?: string) => ({ name, favorite, useCount, lastUsedAt });

  it('search: prefix, then favorites, then most used; ё = е', () => {
    const items = [item('Сыр творожный'), item('Творог 5%', false, 3), item('Творог 9%', true), item('Тёмный шоколад')];
    expect(searchByName(items, 'твор').map((i) => i.name)).toEqual(['Творог 9%', 'Творог 5%', 'Сыр творожный']);
    expect(searchByName(items, 'темный').map((i) => i.name)).toEqual(['Тёмный шоколад']);
    expect(searchByName(items, '  ')).toEqual([]);
  });

  it('quick picks: favorites, then recently used or created', () => {
    const items = [
      item('b', false, 1, '2026-11-02'),
      item('a', true),
      item('c', false, 1, '2026-11-05'),
      { ...item('new'), createdAt: '2026-11-03' },
      item('never'),
    ];
    expect(quickPicks(items).map((i) => i.name)).toEqual(['a', 'c', 'new', 'b']);
  });

  it('parses CSV with header, ; and decimal commas, portions, errors', () => {
    const { foods, errors } = parseFoodCsv(
      '﻿Название;Ккал;Б;Ж;У;Порция;Г\nГречка;343;12,6;3,3;62,1\nЯйцо;157;12,7;11,5;0,7;1 яйцо;55\n\nПлохая;abc;1;1;1\n',
    );
    expect(foods).toEqual([
      { name: 'Гречка', per100: { kcal: 343, p: 12.6, f: 3.3, c: 62.1 } },
      { name: 'Яйцо', per100: { kcal: 157, p: 12.7, f: 11.5, c: 0.7 }, portionName: '1 яйцо', portionG: 55 },
    ]);
    expect(errors).toEqual(['Строка 5: нужно «название; ккал; белки; жиры; углеводы»']);
    expect(parseFoodCsv('Рис,330,7,1,72').foods[0].per100.c).toBe(72);
  });
});

describe('nutrition repo', () => {
  let db: Dexie;
  let snaps: SnapshotStore;
  const uid = () => Math.random().toString(36).slice(2);

  beforeEach(async () => {
    snaps = new SnapshotStore(`snap-${uid()}`);
    db = (await openAppDb({ name: `app-${uid()}`, snapshots: snaps })).db;
  });
  afterEach(() => {
    db.close();
    snaps.close();
  });

  it('logs food, remembers usage, edits grams from the snapshot', async () => {
    const id = await N.addFood(db, { name: ' Гречка ', per100: { kcal: 343, p: 12.6, f: 3.3, c: 62.1 } });
    const food = (await N.listFoods(db))[0];
    expect(food.name).toBe('Гречка');
    await N.logFood(db, '2026-11-08', 'Обед', food, 80);
    const after = (await N.listFoods(db))[0];
    expect(after.useCount).toBe(1);
    expect(after.lastGrams).toBe(80);

    // changing the food later does not change the diary
    await N.updateFood(db, id, { per100: { kcal: 1, p: 1, f: 1, c: 1 } });
    const [e] = await N.entriesForDay(db, '2026-11-08');
    expect(e.total.kcal).toBe(274);
    await N.setEntryGrams(db, e, 100);
    expect((await N.entriesForDay(db, '2026-11-08'))[0].total.kcal).toBe(343);

    await N.deleteFood(db, id);
    expect(await N.entriesForDay(db, '2026-11-08')).toHaveLength(1);
  });

  it('quick repeat uses displayed grams and current food values and refuses deleted foods', async () => {
    const id = await N.addFood(db, { name: 'Каша', per100: { kcal: 100, p: 5, f: 2, c: 15 } });
    await N.logRecentFood(db, '2026-11-08', 'Обед', id, 150);
    const [e] = await N.entriesForDay(db, '2026-11-08');
    expect([e.grams, e.total.kcal, e.foodId]).toEqual([150, 150, id]);
    expect((await N.listFoods(db))[0].lastGrams).toBe(150);
    await N.logRecentFood(db, '2026-11-08', 'Обед', id, 200);
    expect((await N.recentFoodPortions(db)).map((x) => x.grams)).toEqual([200, 150]);
    await N.deleteFood(db, id);
    expect(await N.recentFoodPortions(db)).toEqual([]);
    await expect(N.logRecentFood(db, '2026-11-08', 'Обед', id, 150)).rejects.toThrow('не найден');
    expect(await N.entriesForDay(db, '2026-11-08')).toHaveLength(2);
  });

  it('dish template: from a meal, logged in one go', async () => {
    await N.addFood(db, { name: 'овсянка', per100: { kcal: 350, p: 12, f: 6, c: 60 } });
    await N.addFood(db, { name: 'молоко', per100: { kcal: 60, p: 3, f: 3.2, c: 4.7 } });
    const [oat, milk] = await N.listFoods(db);
    await N.logFood(db, '2026-11-08', 'Завтрак', oat, 60);
    await N.logFood(db, '2026-11-08', 'Завтрак', milk, 200);
    await N.logManual(db, '2026-11-08', 'Завтрак', 'кофе', { kcal: 20, p: 0, f: 0, c: 0 });
    const dishId = await N.saveMealAsDish(db, 'Каша', await N.entriesForDay(db, '2026-11-08'));
    const dish = (await N.listDishes(db)).find((d) => d.id === dishId)!;
    expect(dish.items).toHaveLength(2); // manual entry skipped

    await N.logDish(db, '2026-11-09', 'Завтрак', dish);
    const [e] = await N.entriesForDay(db, '2026-11-09');
    expect(e.total).toEqual({ kcal: 330, p: 13.2, f: 10, c: 45.4 });
    expect(e.grams).toBe(260);
    expect((await N.listDishes(db))[0].useCount).toBe(1);
  });

  it('copies a day or one meal, keeping order', async () => {
    await N.logManual(db, '2026-11-07', 'Завтрак', 'a', { kcal: 1, p: 0, f: 0, c: 0 });
    await N.logManual(db, '2026-11-07', 'Обед', 'b', { kcal: 2, p: 0, f: 0, c: 0 });
    await N.logManual(db, '2026-11-07', 'Обед', 'c', { kcal: 3, p: 0, f: 0, c: 0 });
    expect(await N.copyEntries(db, '2026-11-07', '2026-11-08', 'Обед')).toBe(2);
    expect((await N.entriesForDay(db, '2026-11-08')).map((e) => e.name)).toEqual(['b', 'c']);
    expect(await N.copyEntries(db, '2026-11-07', '2026-11-09')).toBe(3);
    expect((await N.entriesForDay(db, '2026-11-09')).map((e) => e.name)).toEqual(['a', 'b', 'c']);
    expect(await N.entriesForDay(db, '2026-11-07')).toHaveLength(3);
    expect(await N.firstEntryDay(db)).toBe('2026-11-07');
  });

  it('CSV import skips duplicates; goals replace the same start day only', async () => {
    await N.addFood(db, { name: 'Гречка', per100: { kcal: 1, p: 1, f: 1, c: 1 } });
    expect(
      await N.importFoods(db, [
        { name: 'гречка', per100: { kcal: 2, p: 2, f: 2, c: 2 } },
        { name: 'Рис', per100: { kcal: 330, p: 7, f: 1, c: 72 } },
        { name: 'рис', per100: { kcal: 330, p: 7, f: 1, c: 72 } },
      ]),
    ).toEqual({ added: 1, skipped: 2 });

    await N.setGoals(db, '2026-11-15', { kcal: 2600, p: 120, f: 70, c: 360 }, 'calc');
    await N.setGoals(db, '2026-11-15', { kcal: 2700, p: 120, f: 70, c: 380 }, 'manual');
    await N.setGoals(db, '2026-11-22', { kcal: 2800, p: 130, f: 75, c: 390 }, 'calc');
    expect((await N.listGoals(db)).map((g) => [g.from, g.kcal])).toEqual([
      ['2026-11-15', 2700],
      ['2026-11-22', 2800],
    ]);
  });
});
