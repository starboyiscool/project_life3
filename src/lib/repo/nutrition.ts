import type Dexie from 'dexie';
import type { Day } from '../logic/day';
import {
  dishAsFood,
  forGrams,
  type Dish,
  type DishItem,
  type Food,
  type FoodEntry,
  type Macros,
  type NewFood,
  type NutritionGoal,
} from '../logic/nutrition';

const foods = (db: Dexie) => db.table<Food, number>('foods');
const dishes = (db: Dexie) => db.table<Dish, number>('dishes');
const log = (db: Dexie) => db.table<FoodEntry, number>('foodLog');
const goals = (db: Dexie) => db.table<NutritionGoal, number>('nutritionGoals');

const now = () => new Date().toISOString();

// ---- foods ----

export async function listFoods(db: Dexie): Promise<Food[]> {
  return foods(db).toArray();
}

export async function addFood(db: Dexie, f: NewFood): Promise<number> {
  return foods(db).add({ ...f, name: f.name.trim(), favorite: false, useCount: 0, createdAt: now() });
}

/** Adds foods, skipping names that already exist (case-insensitive). Returns how many were added. */
export async function importFoods(db: Dexie, list: NewFood[]): Promise<{ added: number; skipped: number }> {
  return db.transaction('rw', foods(db), async () => {
    const existing = new Set((await foods(db).toArray()).map((f) => f.name.toLowerCase()));
    let added = 0;
    for (const f of list) {
      const key = f.name.trim().toLowerCase();
      if (existing.has(key)) continue;
      existing.add(key);
      await foods(db).add({ ...f, name: f.name.trim(), favorite: false, useCount: 0, createdAt: now() });
      added++;
    }
    return { added, skipped: list.length - added };
  });
}

export async function updateFood(db: Dexie, id: number, changes: Partial<Food>): Promise<void> {
  await foods(db).update(id, changes);
}

/** Deleting a food never touches the diary or dishes: they keep their own copy of the values. */
export async function deleteFood(db: Dexie, id: number): Promise<void> {
  await foods(db).delete(id);
}

// ---- dishes ----

export async function listDishes(db: Dexie): Promise<Dish[]> {
  return dishes(db).toArray();
}

export async function saveDish(db: Dexie, d: Pick<Dish, 'name' | 'items'> & Partial<Dish>): Promise<number> {
  return dishes(db).put({ favorite: false, useCount: 0, createdAt: now(), ...d, name: d.name.trim() });
}

export async function deleteDish(db: Dexie, id: number): Promise<void> {
  await dishes(db).delete(id);
}

/** Saves a meal's gram-based entries as a dish template. Manual (kcal-only) entries are skipped. */
export async function saveMealAsDish(db: Dexie, name: string, entries: FoodEntry[]): Promise<number> {
  const items: DishItem[] = entries
    .filter((e) => e.grams && e.per100)
    .map((e) => ({ foodId: e.foodId, name: e.name, grams: e.grams!, per100: e.per100! }));
  return saveDish(db, { name, items });
}

// ---- diary ----

export async function entriesForDay(db: Dexie, day: Day): Promise<FoodEntry[]> {
  return log(db).where('day').equals(day).sortBy('createdAt');
}

export async function entriesBetween(db: Dexie, from: Day, to: Day): Promise<FoodEntry[]> {
  return log(db).where('day').between(from, to, true, true).toArray();
}

export async function firstEntryDay(db: Dexie): Promise<Day | undefined> {
  return (await log(db).orderBy('day').first())?.day;
}

export async function logFood(db: Dexie, day: Day, meal: string, food: Food, grams: number): Promise<number> {
  return db.transaction('rw', log(db), foods(db), async () => {
    const id = await log(db).add({
      day,
      meal,
      name: food.name,
      grams,
      per100: food.per100,
      total: forGrams(food.per100, grams),
      foodId: food.id,
      createdAt: now(),
    });
    if (food.id != null)
      await foods(db).update(food.id, { useCount: (food.useCount ?? 0) + 1, lastUsedAt: now(), lastGrams: grams });
    return id;
  });
}

/** Recent distinct product + portion pairs; deleted foods and manual/dish entries are omitted. */
export async function recentFoodPortions(db: Dexie, limit = 4): Promise<{ food: Food; grams: number }[]> {
  const [entries, available] = await Promise.all([log(db).reverse().limit(100).toArray(), foods(db).toArray()]);
  const byId = new Map(available.map((f) => [f.id, f]));
  const seen = new Set<string>();
  const result: { food: Food; grams: number }[] = [];
  for (const e of entries) {
    if (e.foodId == null || !e.grams || !Number.isFinite(e.grams) || e.grams <= 0) continue;
    const food = byId.get(e.foodId);
    const key = `${e.foodId}:${e.grams}`;
    if (!food || seen.has(key)) continue;
    seen.add(key);
    result.push({ food, grams: e.grams });
    if (result.length >= limit) break;
  }
  return result;
}

/** Quick repeat re-reads the current food atomically; a deleted food must not be re-created in the diary. */
export async function logRecentFood(db: Dexie, day: Day, meal: string, id: number, grams: number): Promise<number> {
  if (!Number.isFinite(grams) || grams <= 0) throw new Error('Некорректная порция.');
  return db.transaction('rw', log(db), foods(db), async () => {
    const food = await foods(db).get(id);
    if (!food) throw new Error('Продукт больше не найден в базе.');
    return logFood(db, day, meal, food, grams);
  });
}

/** A whole dish as one diary line (its grams can be edited later, values scale). */
export async function logDish(db: Dexie, day: Day, meal: string, dish: Dish): Promise<number> {
  const { grams, per100, total } = dishAsFood(dish.items);
  return db.transaction('rw', log(db), dishes(db), async () => {
    const id = await log(db).add({ day, meal, name: dish.name, grams, per100, total, dishId: dish.id, createdAt: now() });
    if (dish.id != null) await dishes(db).update(dish.id, { useCount: (dish.useCount ?? 0) + 1, lastUsedAt: now() });
    return id;
  });
}

export async function logManual(db: Dexie, day: Day, meal: string, name: string, total: Macros): Promise<number> {
  return log(db).add({ day, meal, name: name.trim() || 'Без названия', total, createdAt: now() });
}

/** Changes the amount of a gram-based entry; values are recomputed from its per-100 g snapshot. */
export async function setEntryGrams(db: Dexie, e: FoodEntry, grams: number): Promise<void> {
  if (e.id == null || !e.per100) return;
  await log(db).update(e.id, { grams, total: forGrams(e.per100, grams) });
}

export async function updateEntry(db: Dexie, id: number, changes: Partial<FoodEntry>): Promise<void> {
  await log(db).update(id, changes);
}

export async function deleteEntry(db: Dexie, id: number): Promise<void> {
  await log(db).delete(id);
}

/** Copies entries of `fromDay` (optionally one meal) to `toDay`. Returns the number copied. */
export async function copyEntries(db: Dexie, fromDay: Day, toDay: Day, meal?: string): Promise<number> {
  return db.transaction('rw', log(db), async () => {
    let src = await log(db).where('day').equals(fromDay).sortBy('createdAt');
    if (meal) src = src.filter((e) => e.meal === meal);
    const t = Date.now();
    for (const [i, e] of src.entries()) {
      const { id: _id, ...rest } = e;
      // keep the original order: createdAt is the sort key within a day
      await log(db).add({ ...rest, day: toDay, createdAt: new Date(t + i).toISOString() });
    }
    return src.length;
  });
}

// ---- goals ----

export async function listGoals(db: Dexie): Promise<NutritionGoal[]> {
  return goals(db).orderBy('from').toArray();
}

/** Sets goals from `from` on. A goal already starting that day is replaced; history stays. */
export async function setGoals(db: Dexie, from: Day, m: Macros, source: NutritionGoal['source']): Promise<void> {
  await db.transaction('rw', goals(db), async () => {
    await goals(db).where('from').equals(from).delete();
    await goals(db).add({ from, kcal: m.kcal, p: m.p, f: m.f, c: m.c, source, createdAt: now() });
  });
}
