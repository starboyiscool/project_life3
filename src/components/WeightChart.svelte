<script lang="ts">
  import { diffDays, formatDayShort } from '../lib/logic/day';
  import { formatKg, movingAverage, type WeightPoint } from '../lib/logic/weight';

  let { entries }: { entries: WeightPoint[] } = $props();

  const W = 340;
  const H = 170;
  const PAD = { l: 36, r: 8, t: 10, b: 22 };

  const ma = $derived(movingAverage(entries));
  const geom = $derived.by(() => {
    if (entries.length === 0) return null;
    const first = entries[0].day;
    const last = entries[entries.length - 1].day;
    const span = Math.max(1, diffDays(first, last));
    const vals = entries.map((e) => e.kg);
    const lo = Math.floor((Math.min(...vals) - 0.3) * 2) / 2;
    const hi = Math.ceil((Math.max(...vals) + 0.3) * 2) / 2;
    const x = (day: string) => PAD.l + (diffDays(first, day) / span) * (W - PAD.l - PAD.r);
    const y = (kg: number) => PAD.t + (1 - (kg - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    return { first, last, lo, hi, x, y };
  });
</script>

{#if geom}
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="График веса: точки — замеры, линия — среднее за 7 дней">
    <line x1={PAD.l} x2={W - PAD.r} y1={geom.y(geom.hi)} y2={geom.y(geom.hi)} class="grid" />
    <line x1={PAD.l} x2={W - PAD.r} y1={geom.y(geom.lo)} y2={geom.y(geom.lo)} class="grid" />
    <text x={PAD.l - 4} y={geom.y(geom.hi) + 4} text-anchor="end">{formatKg(geom.hi)}</text>
    <text x={PAD.l - 4} y={geom.y(geom.lo) + 4} text-anchor="end">{formatKg(geom.lo)}</text>
    <text x={PAD.l} y={H - 4}>{formatDayShort(geom.first)}</text>
    <text x={W - PAD.r} y={H - 4} text-anchor="end">{formatDayShort(geom.last)}</text>

    {#each entries as e (e.day)}
      <circle cx={geom.x(e.day)} cy={geom.y(e.kg)} r="2.5" class="pt" />
    {/each}
    {#if ma.length > 1}
      <polyline points={ma.map((p) => `${geom.x(p.day)},${geom.y(p.avg)}`).join(' ')} class="ma" />
    {/if}
  </svg>
  <p class="muted small legend"><span class="dot"></span> замеры <span class="ln"></span> среднее за 7 дней</p>
{/if}

<style>
  svg {
    width: 100%;
    height: auto;
    display: block;
  }

  .grid {
    stroke: var(--border);
    stroke-width: 1;
  }

  text {
    fill: var(--muted);
    font-size: 10px;
  }

  .pt {
    fill: var(--muted);
    opacity: 0.7;
  }

  .ma {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2.5;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .legend {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--muted);
  }

  .ln {
    width: 16px;
    height: 3px;
    border-radius: 2px;
    background: var(--accent);
    margin-left: 8px;
  }
</style>
