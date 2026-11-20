/** Available pairs per denomination; each denomination is in kilograms per plate. */
export const PLATE_SIZES = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5] as const;
export type PlateConfig = { barKg: number; pairs: number[] };
export const DEFAULT_PLATES: PlateConfig = { barKg: 20, pairs: PLATE_SIZES.map(() => 0) };
export type PlateResult = { total: number; exact: boolean; pairs: number[] };

/** Bounded knapsack on quarter-kg units. Tie between equally near loads favors the lighter one. */
export function calculatePlates(target: number, config: PlateConfig): PlateResult | null {
  const units = (n: number) => Math.round(n * 4);
  const validKg = (n: number) => Number.isFinite(n) && n >= 0 && n <= 500 && Math.abs(n * 4 - units(n)) < 1e-8;
  if (!config || !Array.isArray(config.pairs) || !validKg(target) || !validKg(config.barKg) || config.pairs.length !== PLATE_SIZES.length ||
      config.pairs.some((n) => !Number.isInteger(n) || n < 0 || n > 20)) return null;
  // Totals above 500 can still be the nearest option to a target below 500.
  const cap = 4000;
  const start = units(config.barKg);
  const dp: (number[] | undefined)[] = Array(cap + 1);
  dp[start] = PLATE_SIZES.map(() => 0);
  for (let i = 0; i < PLATE_SIZES.length; i++) {
    const w = units(PLATE_SIZES[i] * 2);
    for (let count = 0; count < config.pairs[i]; count++) {
      for (let j = cap; j >= start + w; j--) {
        if (!dp[j] && dp[j - w]) {
          dp[j] = [...dp[j - w]!];
          dp[j]![i]++;
        }
      }
    }
  }
  const goal = units(target);
  let best = start;
  for (let j = 0; j <= cap; j++) {
    if (dp[j] && (Math.abs(j - goal) < Math.abs(best - goal) || (Math.abs(j - goal) === Math.abs(best - goal) && j < best))) best = j;
  }
  return { total: best / 4, exact: best === goal, pairs: dp[best]! };
}
