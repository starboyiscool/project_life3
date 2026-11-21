/**
 * «Горизонт»: theme change as a planet limb crossing the screen (View Transitions API).
 * Sunrise (to light): the arc rises from below with a warm rim. Sunset (to dark): it descends from
 * above with a cold, silvery rim. Only clip-path and transform are animated.
 */
export type Resolved = 'light' | 'dark';
type Dir = 'up' | 'down';

const DUR = 1100;
const EASE = 'cubic-bezier(.65,.05,.2,1)';
/** A painted frame advances the transition by at most this much, so a slow frame never skips motion. */
const MAX_STEP = 1000 / 30;
const GLOW = 64;

/** Rim colours: line, near glow, far glow, inner glow. */
const RIM: Record<Dir, [string, string, string, string]> = {
  up: ['rgb(255 222 200 / .95)', 'rgb(232 140 100 / .5)', 'rgb(214 110 70 / .16)', 'rgb(240 170 130 / .3)'],
  down: ['rgb(236 242 250 / .9)', 'rgb(190 205 228 / .4)', 'rgb(150 170 205 / .14)', 'rgb(200 212 230 / .22)'],
};

interface Point { c: number; newY: number; oldY: number; rimY: number }
interface Geometry { R: number; band: number; dir: Dir; from: Point; to: Point }

function geometry(dir: Dir): Geometry {
  const W = innerWidth, H = innerHeight;
  const R = Math.max(W * 0.9, H);
  const s = Math.sqrt(R * R - (W * W) / 4); // centre-to-chord distance at the screen edges
  const P = H * 0.015; // parallax, 1.5 % of the height
  const over = Math.max(140, H * 0.15); // the arc clears the corners before the slow tail of the easing
  const band = Math.ceil(R - s + GLOW * 2);
  if (dir === 'up') {
    const c0 = H + R, c1 = s - over;
    return { R, band, dir,
      from: { c: c0, newY: P, oldY: 0, rimY: c0 - R - GLOW },
      to: { c: c1, newY: 0, oldY: -P, rimY: c1 - R - GLOW } };
  }
  const c0 = -R, c1 = H - s + over;
  return { R, band, dir,
    from: { c: c0, newY: -P, oldY: 0, rimY: c0 + R + GLOW - band },
    to: { c: c1, newY: 0, oldY: P, rimY: c1 + R + GLOW - band } };
}

/** One radial gradient on a thin band: cheap to rasterize, unlike a huge blurred shadow. */
function makeRim(g: Geometry): HTMLElement {
  const [line, near, far, inner] = RIM[g.dir];
  const R = g.R;
  const cy = g.dir === 'up' ? GLOW + R : g.band - GLOW - R;
  const el = document.createElement('div');
  el.className = 'horizon-rim';
  el.style.height = `${g.band}px`;
  el.style.background = `radial-gradient(circle at 50% ${cy}px, transparent ${R - 44}px, ${inner} ${R - 8}px, ${line} ${R - 1}px, ${line} ${R + 1}px, ${near} ${R + 7}px, ${far} ${R + 26}px, transparent ${R + GLOW}px)`;
  return el;
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** Frame-driven clock: a slow frame slows the motion for a moment instead of skipping part of it. */
function drive(anims: Animation[], onHalf: () => void): Promise<void> {
  return new Promise((resolve) => {
    let t = 0, last = 0, half = false;
    const step = (now: number) => {
      if (last) t += Math.min(now - last, MAX_STEP);
      last = now;
      const ct = Math.min(t, DUR);
      for (const a of anims) a.currentTime = ct;
      if (!half && ct >= DUR / 2) { half = true; onHalf(); }
      if (ct >= DUR) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/**
 * Runs the transition. `update` switches the DOM to the new theme synchronously; `onHalf` runs at
 * the middle of the path (theme-color). Rejects if the browser skips the transition.
 */
export async function horizon(to: Resolved, update: () => void, onHalf: () => void): Promise<void> {
  const g = geometry(to === 'light' ? 'up' : 'down');
  const rim: { el?: HTMLElement } = {};
  const vt = document.startViewTransition(() => {
    update();
    rim.el = makeRim(g);
    document.body.append(rim.el);
  });
  try {
    await vt.ready;
    const root = document.documentElement;
    const opts = { duration: DUR, easing: EASE, fill: 'both' as const };
    // clip-path lives in the new layer's own coordinates, which the parallax shifts by newY.
    const clip = (k: Point) => `circle(${g.R}px at 50% ${k.c - k.newY}px)`;
    const anims = [
      root.animate(
        [{ clipPath: clip(g.from), transform: `translateY(${g.from.newY}px)` }, { clipPath: clip(g.to), transform: `translateY(${g.to.newY}px)` }],
        { ...opts, pseudoElement: '::view-transition-new(root)' }),
      root.animate(
        [{ transform: `translateY(${g.from.oldY}px)` }, { transform: `translateY(${g.to.oldY}px)` }],
        { ...opts, pseudoElement: '::view-transition-old(root)' }),
      root.animate(
        [{ transform: `translateY(${g.from.rimY}px)`, opacity: 1 }, { opacity: 1, offset: 0.7 }, { transform: `translateY(${g.to.rimY}px)`, opacity: 0 }],
        { ...opts, pseudoElement: '::view-transition-group(horizon-rim)' }),
    ];
    // Hold at 0 % while both layers are rasterized for the first time, then run frame by frame.
    anims.forEach((a) => a.pause());
    await nextFrame();
    await nextFrame();
    await drive(anims, onHalf);
    anims.forEach((a) => a.finish());
    await vt.finished;
  } finally {
    rim.el?.remove();
  }
}
