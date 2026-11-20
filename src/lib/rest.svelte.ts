/**
 * Rest timer. Keeps the end time (not a countdown), so it stays right after the tab
 * was in the background, and survives a reload via localStorage.
 */
const KEY = 'rest-timer';

export const rest = $state<{ until: number | null; total: number; left: number }>({ until: null, total: 0, left: 0 });

let timer: ReturnType<typeof setInterval> | undefined;

function save() {
  try {
    if (rest.until) localStorage.setItem(KEY, JSON.stringify({ until: rest.until, total: rest.total }));
    else localStorage.removeItem(KEY);
  } catch {
    // storage unavailable: the timer still works for this page
  }
}

function tick() {
  if (!rest.until) return;
  rest.left = Math.max(0, (rest.until - Date.now()) / 1000);
  if (rest.left <= 0) {
    stopRest();
    signal();
  }
}

function run() {
  clearInterval(timer);
  timer = setInterval(tick, 250);
  tick();
}

export function startRest(sec: number): void {
  rest.total = sec;
  rest.until = Date.now() + sec * 1000;
  save();
  run();
}

export function addRest(sec: number): void {
  if (!rest.until) return;
  rest.until += sec * 1000;
  rest.total += sec;
  save();
  tick();
}

export function stopRest(): void {
  clearInterval(timer);
  rest.until = null;
  rest.left = 0;
  save();
}

/** Restores a timer that was running before a reload; one that already ran out is dropped silently. */
export function restoreRest(): void {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { until: number; total: number } | null;
    if (v && v.until > Date.now()) {
      rest.until = v.until;
      rest.total = v.total;
      run();
    } else localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

let audio: AudioContext | undefined;

/** Must be called from a tap once, so the browser allows sound later. */
export function unlockSound(): void {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
  } catch {
    // no Web Audio
  }
}

function signal() {
  try {
    navigator.vibrate?.([300, 150, 300]);
  } catch {
    // ignore
  }
  if (!audio) return;
  try {
    for (const [i, f] of [880, 1175].entries()) {
      const o = audio.createOscillator();
      const g = audio.createGain();
      const t = audio.currentTime + i * 0.25;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g).connect(audio.destination);
      o.start(t);
      o.stop(t + 0.25);
    }
  } catch {
    // ignore
  }
}
