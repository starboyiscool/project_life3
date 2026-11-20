import { db } from './app-db';
import { live } from './state.svelte';
import { bodyWeightOn, type Exercise, type Workout, type WorkoutTemplate } from './logic/gym';
import type { Day } from './logic/day';
import { activeWorkout, listDone, listExercises, listTemplates } from './repo/gym';
import { listWeights, type WeightEntry } from './repo/weights';

export interface GymData {
  exercises: Exercise[];
  templates: WorkoutTemplate[];
  /** Done workouts, newest first. */
  done: Workout[];
  active: Workout | null;
  weights: WeightEntry[];
}

const EMPTY: GymData = { exercises: [], templates: [], done: [], active: null, weights: [] };

/** Everything the gym screens read, as one live query. Call during component init. */
export function useGym() {
  const q = live(
    () => async (): Promise<GymData> => {
      const [exercises, templates, done, active, weights] = await Promise.all([
        listExercises(db),
        listTemplates(db),
        listDone(db),
        activeWorkout(db),
        listWeights(db),
      ]);
      return { exercises, templates, done, active: active ?? null, weights };
    },
    EMPTY,
  );
  const exMap = $derived(new Map(q.current.exercises.map((e) => [e.id!, e])));
  return {
    get data() {
      return q.current;
    },
    get loaded() {
      return q.loaded;
    },
    get exMap() {
      return exMap;
    },
    body: (day: Day) => bodyWeightOn(q.current.weights, day),
    name: (id: number) => exMap.get(id)?.name ?? 'Удалённое упражнение',
  };
}
