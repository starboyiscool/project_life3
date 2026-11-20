import { liveQuery } from 'dexie';
import { addDays, DEFAULT_DAY_START_HOUR, logicalDay, type Day } from './logic/day';
import { getMeta, setMeta } from './app-db';
import { DEFAULT_MEALS, type NutritionGoalKind, type Sex } from './logic/nutrition';
import { DEFAULT_GYM, type GymSettings } from './logic/gym';
import { errorText, notify } from './toast.svelte';

export interface Settings {
  dayStartHour: number;
  theme: 'light' | 'dark' | 'system';
  semesterStart?: Day;
  semesterNumber?: number;
}

export const settings = $state<Settings>({ dayStartHour: DEFAULT_DAY_START_HOUR, theme: 'light' });

/** Nutrition profile and options (meta key 'nutrition'). Age and sex stay empty until entered. */
export interface NutritionSettings {
  heightCm: number;
  weightKg: number;
  age?: number;
  sex?: Sex;
  activity: number;
  goal: NutritionGoalKind;
  /** "Расчёт": observed average + this many percent. */
  surplusPct: number;
  meals: string[];
}

export const nutritionSettings = $state<NutritionSettings>({
  heightCm: 173,
  weightKg: 71,
  activity: 1.55,
  goal: 'gain',
  surplusPct: 10,
  meals: [...DEFAULT_MEALS],
});

/** Gym options (meta key 'gym'): kg step, default rest, "через день" interval. */
export const gymSettings = $state<GymSettings>({ ...DEFAULT_GYM });

export async function loadSettings(): Promise<void> {
  const s = await getMeta<Partial<Settings>>('settings');
  Object.assign(settings, { dayStartHour: DEFAULT_DAY_START_HOUR, theme: 'light', semesterStart: undefined, semesterNumber: undefined }, s ?? {});
  const n = await getMeta<Partial<NutritionSettings>>('nutrition');
  Object.assign(nutritionSettings, { heightCm: 173, weightKg: 71, age: undefined, sex: undefined, activity: 1.55, goal: 'gain', surplusPct: 10, meals: [...DEFAULT_MEALS] }, n ?? {});
  const g = await getMeta<Partial<GymSettings>>('gym');
  Object.assign(gymSettings, DEFAULT_GYM, g ?? {});
}

export async function saveGymSettings(patch: Partial<GymSettings>): Promise<void> {
  Object.assign(gymSettings, patch);
  await setMeta('gym', $state.snapshot(gymSettings));
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  Object.assign(settings, patch);
  await setMeta('settings', { ...settings });
}

export async function saveNutritionSettings(patch: Partial<NutritionSettings>): Promise<void> {
  Object.assign(nutritionSettings, patch);
  await setMeta('nutrition', $state.snapshot(nutritionSettings));
}

const clock = $state({ now: new Date() });

export function startClock(): void {
  const tick = () => (clock.now = new Date());
  setInterval(tick, 30_000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && tick());
}

/** Logical today/tomorrow (day ends at settings.dayStartHour, Asia/Novosibirsk). Reactive. */
export const days = {
  get today(): Day {
    return logicalDay(clock.now, settings.dayStartHour);
  },
  get tomorrow(): Day {
    return addDays(this.today, 1);
  },
};

/** Last values of keyed live() queries, shared by every mount with the same key. */
const liveCache = new Map<string, unknown>();

/**
 * Live database query. `make` runs inside an effect, so reactive values read there
 * (e.g. days.today) re-create the query when they change; the returned function is the query.
 * With `key` the last value is kept between mounts, so a re-mounted component shows it at once
 * instead of flashing the empty `initial` state.
 */
export function live<T>(
  make: () => () => Promise<T>,
  initial: T,
  key?: string,
): { readonly current: T; readonly loaded: boolean } {
  const hit = key !== undefined && liveCache.has(key);
  const cached = key === undefined ? undefined : liveCache.get(key);
  let value = $state.raw(hit ? (cached as T) : initial);
  let loaded = $state(hit);
  $effect(() => {
    const query = make();
    const sub = liveQuery(query).subscribe({
      next: (v) => {
        value = v;
        loaded = true;
        if (key !== undefined) liveCache.set(key, v);
      },
      error: (e) => notify(`Ошибка чтения данных: ${errorText(e)}`, 'error'),
    });
    return () => sub.unsubscribe();
  });
  return {
    get current() {
      return value;
    },
    get loaded() {
      return loaded;
    },
  };
}

/** Runs a write and shows any failure; returns false on error. */
export async function act(fn: () => Promise<unknown>, okText?: string): Promise<boolean> {
  try {
    await fn();
    if (okText) notify(okText);
    return true;
  } catch (e) {
    notify(`Не удалось сохранить: ${errorText(e)}`, 'error');
    return false;
  }
}
