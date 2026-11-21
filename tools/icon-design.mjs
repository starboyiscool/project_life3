// Ярлык Life Tracker «Неделя»: терракотовая плитка, сетка 3×3 отметок, часть заполнена.
// Общий растеризатор для gen-icons.mjs (PWA) и gen-ico.mjs (Windows), без внешних зависимостей.
import { deflateSync } from 'node:zlib';

const TOP = [0xb8, 0x5c, 0x40];
const BOTTOM = [0x8c, 0x3f, 0x2c];
const CREAM = [0xfb, 0xf4, 0xea];
const RADIUS = 116 / 512;
/** Filled cells of the week grid, row by row (1 = done, 0 = not yet). */
const CELLS = [1, 1, 1, 1, 1, 0, 1, 0, 0];
const SS = 4; // supersampling per axis

const inRRect = (x, y, x0, y0, w, h, r) => {
  const dx = Math.max(x0 + r - x, 0, x - (x0 + w - r));
  const dy = Math.max(y0 + r - y, 0, y - (y0 + h - r));
  return dx * dx + dy * dy <= r * r;
};

/**
 * size: pixels. full: square without transparent corners (maskable, apple-touch).
 * compact: larger cells for 16-32 px. scale: grid size relative to the tile (maskable safe zone).
 */
export function renderRGBA(size, { full = false, compact = false, scale = 1 } = {}) {
  const g = compact ? { start: 0.155, cell: 0.2, pitch: 0.245 } : { start: 120 / 512, cell: 72 / 512, pitch: 100 / 512 };
  const span = g.pitch * 2 + g.cell;
  const start = 0.5 - (span * scale) / 2;
  const cell = g.cell * scale, pitch = g.pitch * scale, cr = (compact ? 0.06 : 22 / 512) * scale;
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, gg = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size, v = (y + (sy + 0.5) / SS) / size;
          if (!full && !inRRect(u, v, 0, 0, 1, 1, RADIUS)) continue;
          const t = Math.min(1, Math.max(0, (u + v) / 2));
          let c = TOP.map((k, i) => k + (BOTTOM[i] - k) * t);
          const col = Math.floor((u - start) / pitch), row = Math.floor((v - start) / pitch);
          if (col >= 0 && col < 3 && row >= 0 && row < 3 && inRRect(u, v, start + col * pitch, start + row * pitch, cell, cell, cr)) {
            const o = CELLS[row * 3 + col] ? 1 : 0.22;
            c = c.map((k, i) => k + (CREAM[i] - k) * o);
          }
          r += c[0]; gg += c[1]; b += c[2]; a++;
        }
      }
      const i = (y * size + x) * 4;
      if (a) { px[i] = Math.round(r / a); px[i + 1] = Math.round(gg / a); px[i + 2] = Math.round(b / a); }
      px[i + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  return px;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** RGBA PNG. */
export function png(size, opts) {
  const px = renderRGBA(size, opts);
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Multi-size .ico with PNG entries. */
export function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, data } of images) {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size;
    e[1] = size >= 256 ? 0 : size;
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...images.map((x) => x.data)]);
}
