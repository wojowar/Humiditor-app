/**
 * Generates the PWA icons with zlib only - no image dependency to install or
 * keep current. Draws a cigar on a dark field: body, lighter band, ashed tip.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, paint) {
  // One filter byte (0 = None) per scanline, then RGB triples.
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = paint(x / size, y / size);
      const off = y * stride + 1 + x * 3;
      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const BG = [0x17, 0x13, 0x0f];
const BODY = [0x6b, 0x4a, 0x2c];
const BAND = [0xc8, 0x87, 0x3f];
const ASH = [0xd8, 0xd0, 0xc4];

// Diagonal cigar across the tile, band a third of the way up from the foot.
function paint(u, v) {
  const t = (u + (1 - v)) / 2; // 0 at the head, 1 at the lit foot
  const d = Math.abs(u - (1 - v)) / Math.SQRT2; // distance from the axis
  const halfWidth = 0.085;

  if (t < 0.16 || t > 0.9 || d > halfWidth) return BG;
  // Taper the head slightly so it reads as a cigar, not a stick.
  if (t < 0.24 && d > halfWidth * (0.45 + (t - 0.16) * 6)) return BG;
  if (t > 0.83) return ASH;
  if (t > 0.36 && t < 0.5) return BAND;
  return BODY;
}

mkdirSync("public", { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(`public/icon-${size}.png`, png(size, paint));
}
writeFileSync("public/apple-touch-icon.png", png(180, paint));
console.log("icons written");
