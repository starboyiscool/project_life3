<script lang="ts">
  import { diffDays, formatDayShort, type Day } from '../../lib/logic/day';
  import { fmtKg } from '../../lib/logic/gym';

  let { points, label }: { points: { day: Day; v: number }[]; label: string } = $props();

  const W = 340;
  const H = 160;
  const PAD = { l: 36, r: 8, t: 10, b: 22 };

  const geom = $derived.by(() => {
    if (!points.length) return null;
    const first = points[0].day;
    const last = points[points.length - 1].day;
    const span = Math.max(1, diffDays(first, last));
    const vals = points.map((p) => p.v);
    const pad = Math.max(1, (Math.max(...vals) - Math.min(...vals)) * 0.1);
    const lo = Math.floor(Math.min(...vals) - pad);
    const hi = Math.ceil(Math.max(...vals) + pad);
    const x = (d: Day) => (points.length === 1 ? (W + PAD.l) / 2 : PAD.l + (diffDays(first, d) / span) * (W - PAD.l - PAD.r));
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    return { first, last, lo, hi, x, y };
  });
</script>

{#if geom}
  <svg viewBox="0 0 {W} {H}" role="img" aria-label={label}>
    <line x1={PAD.l} x2={W - PAD.r} y1={geom.y(geom.hi)} y2={geom.y(geom.hi)} class="grid" />
    <line x1={PAD.l} x2={W - PAD.r} y1={geom.y(geom.lo)} y2={geom.y(geom.lo)} class="grid" />
    <text x={PAD.l - 4} y={geom.y(geom.hi) + 4} text-anchor="end">{fmtKg(geom.hi)}</text>
    <text x={PAD.l - 4} y={geom.y(geom.lo) + 4} text-anchor="end">{fmtKg(geom.lo)}</text>
    <text x={PAD.l} y={H - 4}>{formatDayShort(geom.first)}</text>
    {#if points.length > 1}<text x={W - PAD.r} y={H - 4} text-anchor="end">{formatDayShort(geom.last)}</text>{/if}
    {#if points.length > 1}
      <polyline points={points.map((p) => `${geom.x(p.day)},${geom.y(p.v)}`).join(' ')} class="ln" />
    {/if}
    {#each points as p, i (i)}<circle cx={geom.x(p.day)} cy={geom.y(p.v)} r="3" class="pt" />{/each}
  </svg>
{/if}

<style>
  svg {
    width: 100%;
    height: auto;
    display: block;
  }

  .grid {
    stroke: var(--border);
  }

  text {
    fill: var(--muted);
    font-size: 10px;
  }

  .ln {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2.5;
    stroke-linejoin: round;
  }

  .pt {
    fill: var(--accent);
  }
</style>
