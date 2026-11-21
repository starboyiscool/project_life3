// Этап 2 редизайна Life Tracker: токены цветов, теней, шрифтов и движения.
// Запуск из корня проекта: node stage2/apply.mjs   (только проверка: --dry)
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const dry = process.argv.includes('--dry');
const NL = String.fromCharCode(10);
const CRLF = String.fromCharCode(13, 10);
if (!existsSync(join(root, 'package.json')) || !existsSync(join(root, 'src', 'app.css'))) {
  console.error('Run from the project root (where package.json is).');
  process.exit(1);
}
const read = (p) => { const raw = readFileSync(p, 'utf8'); const t = raw.split(CRLF).join(NL); return { text: t, orig: t, crlf: raw.includes(CRLF) }; };
const SPECIAL = '.*+?^$' + '{}()|[]/' + String.fromCharCode(92);
const esc = (s) => [...s].map((c) => (SPECIAL.includes(c) ? String.fromCharCode(92) + c : c)).join('');
const WS = '[ ' + String.fromCharCode(9, 13, 10) + ']+';
const loose = (s) => new RegExp(s.trim().split(new RegExp(WS)).map(esc).join(WS));
const cache = new Map();
const get = (p) => { if (!cache.has(p)) cache.set(p, read(p)); return cache.get(p); };
const rel = (p) => relative(root, p).split(sep).join('/');
const problems = [];

for (const e of JSON.parse(readFileSync(join(here, 'edits.json'), 'utf8'))) {
  const p = join(root, e.file);
  if (!existsSync(p)) { problems.push(e.file + ': file not found'); continue; }
  const cur = get(p);
  if (e.replace && cur.text.includes(e.replace)) { console.log('= ' + e.file + ' (' + e.why + ')'); continue; }
  if (cur.text.includes(e.find)) cur.text = cur.text.replace(e.find, () => e.replace);
  else if (loose(e.find).test(cur.text)) cur.text = cur.text.replace(loose(e.find), () => e.replace);
  else if (!e.replace) { console.log('= ' + e.file + ' (' + e.why + ')'); continue; }
  else { problems.push(e.file + ': ' + e.why); continue; }
  console.log('~ ' + e.file + ': ' + e.why);
}

const SCALE = { 0.7: 'xs', 0.72: 'xs', 0.75: 'xs', 0.8: 'sm', 0.85: 'sm', 0.875: 'sm', 0.9: 'sm', 0.92: 'sm', 1: 'md', 1.05: 'md', 1.15: 'lg', 1.2: 'lg', 1.3: 'xl', 1.4: 'xl', 1.5: 'xl', 2: 'xl' };
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const all = walk(join(root, 'src'));
const styleFiles = all.filter((p) => p.endsWith('.svelte') || p.endsWith('.css'));
const unknown = [];
for (const p of styleFiles) {
  const cur = get(p);
  let n = 0;
  cur.text = cur.text.replace(/font-size:( *)([0-9]*[.]?[0-9]+)rem/g, (m, gap, v) => {
    const step = SCALE[Number(v)];
    if (!step) { unknown.push(rel(p) + ': ' + v + 'rem'); return m; }
    n++;
    return 'font-size:' + (gap || ' ') + 'var(--fs-' + step + ')';
  });
  if (n) console.log('~ ' + rel(p) + ': font-size -> scale (' + n + ')');
}

const cssPath = join(root, 'src', 'app.css');
const css = get(cssPath);
for (const name of ['sand', 'sage', 'mist', 'lilac']) {
  const token = '--mesh-' + name;
  const used = all.filter((p) => p !== cssPath && /[.](svelte|ts|css|js)$/.test(p)).some((p) => get(p).text.includes(token));
  if (used) { console.log('! ' + token + ' is used, kept'); continue; }
  const before = css.text;
  css.text = css.text.split(NL).filter((l) => !l.trim().startsWith(token + ':')).join(NL);
  if (css.text !== before) console.log('~ src/app.css: removed unused ' + token);
}

if (unknown.length) console.log(NL + 'Off-scale sizes left as is:' + NL + unknown.map((x) => '  - ' + x).join(NL));
if (problems.length) {
  console.error(NL + 'NOTHING CHANGED. Fragments not found:' + NL + problems.map((x) => '  - ' + x).join(NL));
  process.exit(1);
}
if (dry) { console.log(NL + 'Dry run OK, nothing written.'); process.exit(0); }
let changed = 0;
for (const [p, v] of cache) {
  if (v.text === v.orig) continue;
  writeFileSync(p, v.crlf ? v.text.split(NL).join(CRLF) : v.text, 'utf8');
  changed++;
}
console.log(NL + 'Done, files changed: ' + changed + '. Review: git diff');
