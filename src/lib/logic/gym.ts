import { addDays, type Day } from './day';
import type { WeightPoint } from './weight';

export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'forearms' | 'legs' | 'core';

export const MUSCLE_GROUPS: { id: MuscleGroup; label: string }[] = [
  { id: 'chest', label: 'Грудь' },
  { id: 'back', label: 'Спина' },
  { id: 'shoulders', label: 'Плечи' },
  { id: 'biceps', label: 'Бицепс' },
  { id: 'triceps', label: 'Трицепс' },
  { id: 'forearms', label: 'Предплечья' },
  { id: 'legs', label: 'Ноги' },
  { id: 'core', label: 'Пресс' },
];

export const groupLabel = (g: MuscleGroup) => MUSCLE_GROUPS.find((x) => x.id === g)?.label ?? g;

/** bodyweight_plus: the entered kg is the added weight (belt, vest); body weight comes from «Вес». */
export type LoadType = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight' | 'bodyweight_plus';

export const LOAD_TYPES: { id: LoadType; label: string }[] = [
  { id: 'barbell', label: 'Штанга' },
  { id: 'dumbbell', label: 'Гантели' },
  { id: 'cable', label: 'Блок' },
  { id: 'machine', label: 'Тренажёр' },
  { id: 'bodyweight', label: 'Свой вес' },
  { id: 'bodyweight_plus', label: 'Свой вес + отягощение' },
];

export const loadLabel = (l: LoadType) => LOAD_TYPES.find((x) => x.id === l)?.label ?? l;
export const isBodyweight = (l: LoadType) => l === 'bodyweight' || l === 'bodyweight_plus';

export interface Exercise {
  id?: number;
  name: string;
  primary: MuscleGroup;
  secondary: MuscleGroup[];
  load: LoadType;
  /** Compound lifts get the longer default rest. */
  compound: boolean;
  /** Overrides of the global step / rest. */
  stepKg?: number;
  restSec?: number;
  preset: boolean;
  archived?: boolean;
  createdAt: string;
}

export interface TemplateItem {
  exerciseId: number;
  sets: number;
  repMin: number;
  repMax: number;
}

export interface WorkoutTemplate {
  id?: number;
  name: string;
  items: TemplateItem[];
  /** Made by the app, not by the user: shown as «предложение» until edited. */
  suggestion: boolean;
  order: number;
  createdAt: string;
}

export type SetKind = 'warmup' | 'work';

export interface WorkSet {
  /** For bodyweight_plus: added weight (0 = pure reps). For bodyweight: always 0. */
  kg: number;
  reps: number;
  kind: SetKind;
  failure?: boolean;
  rpe?: number;
  note?: string;
  at: string;
}

export interface WorkoutItem {
  exerciseId: number;
  target?: { sets: number; repMin: number; repMax: number };
  sets: WorkSet[];
}

export interface Workout {
  id?: number;
  day: Day;
  templateId?: number;
  status: 'active' | 'done';
  items: WorkoutItem[];
  note?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface GymSettings {
  stepKg: number;
  restCompoundSec: number;
  restIsolationSec: number;
  /** "через день" = 2. */
  intervalDays: number;
}

export const DEFAULT_GYM: GymSettings = { stepKg: 2.5, restCompoundSec: 150, restIsolationSec: 90, intervalDays: 2 };

type Preset = Omit<Exercise, 'id' | 'preset' | 'createdAt'>;

/** Basic exercises from the requirements. No weights anywhere: those are the user's. */
export const PRESET_EXERCISES: Preset[] = [
  { name: 'Подтягивания', primary: 'back', secondary: ['biceps', 'forearms'], load: 'bodyweight_plus', compound: true },
  { name: 'Жим лёжа', primary: 'chest', secondary: ['triceps', 'shoulders'], load: 'barbell', compound: true },
  { name: 'Отжимания на брусьях', primary: 'chest', secondary: ['triceps', 'shoulders'], load: 'bodyweight_plus', compound: true },
  { name: 'Тяга штанги в наклоне', primary: 'back', secondary: ['biceps', 'forearms'], load: 'barbell', compound: true },
  { name: 'Сгибания рук со штангой', primary: 'biceps', secondary: ['forearms'], load: 'barbell', compound: false },
  { name: 'Молотковые сгибания', primary: 'biceps', secondary: ['forearms'], load: 'dumbbell', compound: false },
  { name: 'Сгибания запястий', primary: 'forearms', secondary: [], load: 'barbell', compound: false },
  { name: 'Обратные сгибания запястий', primary: 'forearms', secondary: [], load: 'barbell', compound: false },
];

/** «Верх» suggestion: names → sets × rep range. Marked as a suggestion in the UI. */
export const SUGGESTED_UPPER: { name: string; sets: number; repMin: number; repMax: number }[] = [
  { name: 'Подтягивания', sets: 3, repMin: 6, repMax: 10 },
  { name: 'Жим лёжа', sets: 3, repMin: 4, repMax: 8 },
  { name: 'Отжимания на брусьях', sets: 3, repMin: 6, repMax: 12 },
  { name: 'Тяга штанги в наклоне', sets: 3, repMin: 8, repMax: 12 },
  { name: 'Сгибания рук со штангой', sets: 3, repMin: 8, repMax: 12 },
  { name: 'Сгибания запястий', sets: 2, repMin: 12, repMax: 20 },
];

// ---------- numbers ----------

/** Estimated one-rep max (Epley). Always shown as an estimate. */
export function epley(kg: number, reps: number): number {
  if (kg <= 0 || reps <= 0) return 0;
  return reps === 1 ? kg : kg * (1 + reps / 30);
}

/** Body weight for a day: entry of that day (weighed after training) or the latest before it. */
export function bodyWeightOn(weights: WeightPoint[], day: Day): number | null {
  let best: WeightPoint | null = null;
  for (const w of weights) if (w.day <= day && (!best || w.day > best.day)) best = w;
  return best?.kg ?? null;
}

/** Total moved load of one rep; null when body weight is needed but unknown. */
export function setLoad(s: Pick<WorkSet, 'kg'>, load: LoadType, bodyKg: number | null): number | null {
  if (!isBodyweight(load)) return s.kg;
  return bodyKg == null ? null : bodyKg + s.kg;
}

export const restFor = (ex: Exercise, g: GymSettings) => ex.restSec ?? (ex.compound ? g.restCompoundSec : g.restIsolationSec);
export const stepFor = (ex: Exercise, g: GymSettings) => ex.stepKg ?? g.stepKg;

export const roundKg = (n: number) => Math.round(n * 100) / 100;

// ---------- history ----------

export interface Performance {
  workoutId: number;
  day: Day;
  item: WorkoutItem;
}

/** Most recent done workout with sets of this exercise, other than `exceptId`. `done` must be sorted by day desc. */
export function lastPerformance(done: Workout[], exerciseId: number, exceptId?: number): Performance | null {
  for (const w of done) {
    if (w.id === exceptId || w.status !== 'done') continue;
    const item = w.items.find((i) => i.exerciseId === exerciseId && i.sets.length);
    if (item) return { workoutId: w.id!, day: w.day, item };
  }
  return null;
}

/**
 * Values for the next set: the same set of last time, else repeat the set just done,
 * else the bottom of the target range with no weight.
 */
export function prefillSet(prev: WorkSet[] | undefined, doneNow: WorkSet[], target?: WorkoutItem['target']): Pick<WorkSet, 'kg' | 'reps' | 'kind'> {
  const i = doneNow.length;
  const p = prev?.[i];
  if (p) return { kg: p.kg, reps: p.reps, kind: p.kind };
  const last = doneNow.at(-1);
  if (last) return { kg: last.kg, reps: last.reps, kind: 'work' };
  return { kg: 0, reps: target?.repMin ?? 8, kind: 'work' };
}

/**
 * Hint, not a rule: if last time every work set reached the top of the rep range,
 * suggest the heaviest work weight + one step.
 */
export function progressionHint(prev: WorkSet[] | undefined, target: WorkoutItem['target'] | undefined, step: number): number | null {
  if (!prev || !target) return null;
  const work = prev.filter((s) => s.kind === 'work');
  if (!work.length || work.length < target.sets) return null;
  if (!work.every((s) => s.reps >= target.repMax)) return null;
  return roundKg(Math.max(...work.map((s) => s.kg)) + step);
}

export interface Records {
  /** Heaviest entered kg in a work set (added weight for bodyweight_plus). */
  maxKg: number | null;
  maxE1rm: number | null;
  /** Work sets as (kg, reps) to answer "most reps at this weight or heavier". */
  sets: { kg: number; reps: number }[];
}

export const EMPTY_RECORDS: Records = { maxKg: null, maxE1rm: null, sets: [] };

export interface Dated {
  day: Day;
  sets: WorkSet[];
}

export function recordsOf(history: Dated[], load: LoadType, body: (day: Day) => number | null): Records {
  const r: Records = { maxKg: null, maxE1rm: null, sets: [] };
  for (const h of history) {
    for (const s of h.sets) {
      if (s.kind !== 'work' || s.reps <= 0) continue;
      r.sets.push({ kg: s.kg, reps: s.reps });
      if (load !== 'bodyweight' && (r.maxKg == null || s.kg > r.maxKg)) r.maxKg = s.kg;
      const l = setLoad(s, load, body(h.day));
      if (l != null) {
        const e = epley(l, s.reps);
        if (r.maxE1rm == null || e > r.maxE1rm) r.maxE1rm = e;
      }
    }
  }
  return r;
}

export type RecordKind = 'kg' | 'reps' | 'e1rm';

/** Which records a new work set beats. Nothing for the very first sets of an exercise. */
export function newRecords(s: Pick<WorkSet, 'kg' | 'reps' | 'kind'>, prev: Records, load: LoadType, bodyKg: number | null): RecordKind[] {
  if (s.kind !== 'work' || s.reps <= 0 || !prev.sets.length) return [];
  const out: RecordKind[] = [];
  if (load !== 'bodyweight' && prev.maxKg != null && s.kg > prev.maxKg) out.push('kg');
  const heavier = prev.sets.filter((p) => p.kg >= s.kg);
  if (heavier.length && s.reps > Math.max(...heavier.map((p) => p.reps))) out.push('reps');
  const l = setLoad(s, load, bodyKg);
  if (l != null && prev.maxE1rm != null && epley(l, s.reps) > prev.maxE1rm + 0.05) out.push('e1rm');
  return out;
}

export const RECORD_LABELS: Record<RecordKind, string> = { kg: 'вес', reps: 'повторы на этом весе', e1rm: '1ПМ (оценка)' };

/** Workouts that happened before `w` (records are "at that time", also when editing an old one). */
export function before(all: Workout[], w: Pick<Workout, 'id' | 'day' | 'startedAt'>): Workout[] {
  return all.filter((o) => o.id !== w.id && o.status === 'done' && (o.day < w.day || (o.day === w.day && o.startedAt < w.startedAt)));
}

export function historyOf(workouts: Workout[], exerciseId: number): Dated[] {
  return workouts.flatMap((o) => o.items.filter((i) => i.exerciseId === exerciseId).map((i) => ({ day: o.day, sets: i.sets })));
}

/** Records set in a workout, keyed "item:set", against everything before it and earlier sets of it. */
export function markRecords(
  w: Workout,
  earlier: Workout[],
  exercises: Map<number, Exercise>,
  body: (day: Day) => number | null,
): Map<string, RecordKind[]> {
  const out = new Map<string, RecordKind[]>();
  // an exercise can appear twice in one workout: its earlier block counts as history
  const seen: { ex: number; d: Dated }[] = [];
  w.items.forEach((it, i) => {
    const ex = exercises.get(it.exerciseId);
    if (!ex) return;
    const hist = [...historyOf(earlier, it.exerciseId), ...seen.filter((x) => x.ex === it.exerciseId).map((x) => x.d)];
    // the first time an exercise is done, every set would be a "record": skip it
    if (!hist.some((h) => h.sets.length)) {
      seen.push({ ex: it.exerciseId, d: { day: w.day, sets: it.sets } });
      return;
    }
    it.sets.forEach((s, j) => {
      const prior = [...hist, { day: w.day, sets: it.sets.slice(0, j) }];
      const kinds = newRecords(s, recordsOf(prior, ex.load, body), ex.load, body(w.day));
      if (kinds.length) out.set(`${i}:${j}`, kinds);
    });
    seen.push({ ex: it.exerciseId, d: { day: w.day, sets: it.sets } });
  });
  return out;
}

// ---------- schedule ----------

export interface NextWorkout {
  due: Day;
  template: WorkoutTemplate | null;
}

/**
 * "Через день" counted from the last done workout, so a missed day shifts the cycle
 * instead of breaking it. Templates rotate in `order`; a skipped day does not advance it.
 */
export function nextWorkout(done: Workout[], templates: WorkoutTemplate[], intervalDays: number, today: Day): NextWorkout {
  const sorted = [...templates].sort((a, b) => a.order - b.order);
  const last = done.filter((w) => w.status === 'done').reduce<Workout | null>((a, w) => (!a || w.day > a.day ? w : a), null);
  if (!last) return { due: today, template: sorted[0] ?? null };
  const due = addDays(last.day, intervalDays);
  const idx = sorted.findIndex((t) => t.id === last.templateId);
  return { due: due < today ? today : due, template: sorted.length ? sorted[(idx + 1) % sorted.length] : null };
}

// ---------- progress ----------

export interface VolumeRow {
  sets: number;
  reps: number;
  /** Σ load × reps over sets with a known load. */
  tonnage: number;
  /** Some bodyweight sets had no known body weight, so tonnage is understated. */
  partial: boolean;
}

const addVol = (r: VolumeRow, sets: number, reps: number, t: number | null): VolumeRow => ({
  sets: r.sets + sets,
  reps: r.reps + reps,
  tonnage: r.tonnage + (t ?? 0),
  partial: r.partial || t == null,
});

/** Work-set volume per exercise and per primary muscle group. */
export function volume(workouts: Workout[], exercises: Map<number, Exercise>, body: (day: Day) => number | null) {
  const byExercise = new Map<number, VolumeRow>();
  const byGroup = new Map<MuscleGroup, VolumeRow>();
  for (const w of workouts) {
    for (const it of w.items) {
      const ex = exercises.get(it.exerciseId);
      if (!ex) continue;
      let sets = 0;
      let reps = 0;
      let t: number | null = 0;
      for (const s of it.sets) {
        if (s.kind !== 'work') continue;
        sets++;
        reps += s.reps;
        const l = setLoad(s, ex.load, body(w.day));
        t = l == null || t == null ? null : t + l * s.reps;
      }
      if (!sets) continue;
      const zero: VolumeRow = { sets: 0, reps: 0, tonnage: 0, partial: false };
      byExercise.set(ex.id!, addVol(byExercise.get(ex.id!) ?? zero, sets, reps, t));
      byGroup.set(ex.primary, addVol(byGroup.get(ex.primary) ?? zero, sets, reps, t));
    }
  }
  return { byExercise, byGroup };
}

export interface SeriesPoint {
  day: Day;
  e1rm: number | null;
  maxKg: number;
  bestReps: number;
}

/** One point per workout with this exercise (best work set), oldest first. */
export function exerciseSeries(workouts: Workout[], ex: Exercise, body: (day: Day) => number | null): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (const w of [...workouts].sort((a, b) => a.day.localeCompare(b.day))) {
    if (w.status !== 'done') continue;
    const work = w.items.filter((i) => i.exerciseId === ex.id).flatMap((i) => i.sets.filter((s) => s.kind === 'work' && s.reps > 0));
    if (!work.length) continue;
    let e1rm: number | null = null;
    for (const s of work) {
      const l = setLoad(s, ex.load, body(w.day));
      if (l != null) e1rm = Math.max(e1rm ?? 0, epley(l, s.reps));
    }
    out.push({ day: w.day, e1rm, maxKg: Math.max(...work.map((s) => s.kg)), bestReps: Math.max(...work.map((s) => s.reps)) });
  }
  return out;
}

// ---------- text ----------

/** "62,5" / "62" without trailing zeros, comma decimal. */
export function fmtKg(n: number): string {
  return String(roundKg(n)).replace('.', ',');
}

export function setText(s: Pick<WorkSet, 'kg' | 'reps'>, load: LoadType): string {
  if (load === 'bodyweight') return `${s.reps}`;
  if (load === 'bodyweight_plus') return s.kg ? `+${fmtKg(s.kg)} × ${s.reps}` : `${s.reps}`;
  return `${fmtKg(s.kg)} × ${s.reps}`;
}

export function parseKgInput(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '') return 0;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n < 1000 ? roundKg(n) : null;
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
