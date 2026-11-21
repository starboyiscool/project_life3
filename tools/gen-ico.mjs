// Windows .ico from the «Неделя» design (tools/icon-design.mjs): `npm run icon:ico`.
// 16-32 px use larger cells, so the grid stays readable on the taskbar.
import { writeFileSync, mkdirSync } from 'node:fs';
import { ico, png } from './icon-design.mjs';

mkdirSync('build', { recursive: true });
const sizes = [16, 24, 32, 48, 64, 128, 256];
writeFileSync('build/icon.ico', ico(sizes.map((size) => ({ size, data: png(size, { compact: size <= 32 }) }))));
console.log('build/icon.ico');
