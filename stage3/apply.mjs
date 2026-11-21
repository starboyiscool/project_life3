// Этап 3 редизайна Life Tracker: переход тем «Горизонт». Запуск: node stage3/apply.mjs (проверка: --dry)
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const dry = process.argv.includes('--dry');
const NL = String.fromCharCode(10);
const CRLF = String.fromCharCode(13, 10);
if (!existsSync(join(root, 'package.json')) || !existsSync(join(root, 'src', 'App.svelte'))) {
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
const problems = [];

for (const e of JSON.parse(readFileSync(join(here, 'edits.json'), 'utf8'))) {
  const p = join(root, e.file);
  if (!existsSync(p)) { problems.push(e.file + ': file not found'); continue; }
  const cur = get(p);
  if ((e.replace && cur.text.includes(e.replace)) || (e.absent && !cur.text.includes(e.absent))) { console.log('= ' + e.file + ' (' + e.why + ')'); continue; }
  if (cur.text.includes(e.find)) cur.text = cur.text.replace(e.find, () => e.replace);
  else if (loose(e.find).test(cur.text)) cur.text = cur.text.replace(loose(e.find), () => e.replace);
  else { problems.push(e.file + ': ' + e.why); continue; }
  console.log('~ ' + e.file + ': ' + e.why);
}
const filesDir = join(here, 'files');
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const full = walk(filesDir).map((src) => ({ src, rel: relative(filesDir, src).split(sep).join('/') }));
if (problems.length) {
  console.error(NL + 'NOTHING CHANGED. Fragments not found:' + NL + problems.map((x) => '  - ' + x).join(NL));
  process.exit(1);
}
for (const f of full) console.log('+ ' + f.rel);
if (dry) { console.log(NL + 'Dry run OK, nothing written.'); process.exit(0); }
const projectCrlf = get(join(root, 'src', 'App.svelte')).crlf;
for (const f of full) {
  const target = join(root, f.rel);
  mkdirSync(dirname(target), { recursive: true });
  const crlf = existsSync(target) ? read(target).crlf : projectCrlf;
  const text = read(f.src).text;
  writeFileSync(target, crlf ? text.split(NL).join(CRLF) : text, 'utf8');
}
for (const [p, v] of cache) if (v.text !== v.orig) writeFileSync(p, v.crlf ? v.text.split(NL).join(CRLF) : v.text, 'utf8');
console.log(NL + 'Done. Review: git diff');
