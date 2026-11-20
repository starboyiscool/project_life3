import { describe, expect, it } from 'vitest';
import { calculatePlates, PLATE_SIZES } from '../src/lib/logic/plates';

const pairs = (values: Record<string, number>) => PLATE_SIZES.map((v) => values[String(v)] ?? 0);
describe('barbell plates', () => {
  it('finds a balanced exact weight with bounded inventory', () => {
    const r = calculatePlates(62.5, { barKg: 20, pairs: pairs({ 20: 1, 1.25: 1 }) });
    expect(r?.exact).toBe(true);
    expect(r?.total).toBe(62.5);
    expect(r?.pairs).toEqual(pairs({ 20: 1, 1.25: 1 }));
  });
  it('returns closest load, preferring lighter on a tie; does not add unavailable plates', () => {
    expect(calculatePlates(61.25, { barKg: 20, pairs: pairs({ 20: 1, 1.25: 1 }) })?.total).toBe(60);
    expect(calculatePlates(100, { barKg: 20, pairs: pairs({ 20: 1 }) })?.total).toBe(60);
    expect(calculatePlates(10, { barKg: 20, pairs: pairs({}) })?.total).toBe(20);
  });
  it('considers a nearest available total above the 500 kg target limit', () => {
    expect(calculatePlates(499, { barKg: 21, pairs: pairs({ 20: 12 }) })?.total).toBe(501);
  });
  it('rejects invalid configurations and fractions outside quarter kg', () => {
    expect(calculatePlates(60.1, { barKg: 20, pairs: pairs({}) })).toBeNull();
    expect(calculatePlates(60, { barKg: 20, pairs: pairs({ 20: -1 }) })).toBeNull();
    expect(calculatePlates(60, { barKg: 20, pairs: pairs({ 20: 2.5 }) })).toBeNull();
    expect(calculatePlates(60, { barKg: 20, pairs: [] })).toBeNull();
  });
});
