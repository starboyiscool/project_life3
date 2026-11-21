// PWA icons from the «Неделя» design (tools/icon-design.mjs): `npm run icons`.
import { writeFileSync, mkdirSync } from 'node:fs';
import { png } from './icon-design.mjs';

mkdirSync('public/icons', { recursive: true });
for (const [name, size, opts] of [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  // maskable: full-bleed tile, grid kept inside the 80 % safe zone
  ['maskable-512.png', 512, { full: true, scale: 0.86 }],
  // iOS rounds the corners itself
  ['apple-touch-icon.png', 180, { full: true }],
]) {
  writeFileSync(`public/icons/${name}`, png(size, opts));
  console.log(`public/icons/${name}`);
}
