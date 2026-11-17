/* Genere les icones PNG (180, 192, 512) sans dependance : un haltere volt sur
   fond nuit, rasterise a la main avec sur-echantillonnage 4x.
   Usage : node tools/make-icons.js */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BG = [14, 15, 16], FG = [212, 255, 58];

/* Formes en coordonnees 0..1 : rectangles arrondis [x, y, w, h, rayon] */
const SHAPES = [
  [0.20, 0.30, 0.10, 0.40, 0.03], [0.70, 0.30, 0.10, 0.40, 0.03], /* gros disques */
  [0.12, 0.37, 0.07, 0.26, 0.025], [0.81, 0.37, 0.07, 0.26, 0.025], /* petits disques */
  [0.29, 0.465, 0.42, 0.07, 0.02] /* barre */
];

function inRRect(px, py, r) {
  const [x, y, w, h, rad] = r;
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const cx = Math.min(Math.max(px, x + rad), x + w - rad);
  const cy = Math.min(Math.max(py, y + rad), y + h - rad);
  return (px - cx) ** 2 + (py - cy) ** 2 <= rad * rad;
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  const SS = 4;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let hit = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const px = (x + (sx + 0.5) / SS) / size, py = (y + (sy + 0.5) / SS) / size;
        if (SHAPES.some(r => inRRect(px, py, r))) hit++;
      }
      const a = hit / (SS * SS);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      for (let c = 0; c < 3; c++) raw[o + c] = Math.round(BG[c] * (1 - a) + FG[c] * a);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
  ]);
}

[180, 192, 512].forEach(s => {
  fs.writeFileSync(path.join(__dirname, '..', 'icon-' + s + '.png'), png(s));
  console.log('icon-' + s + '.png');
});
