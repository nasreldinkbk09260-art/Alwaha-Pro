import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, 'dist');
const svg = path.join(here, 'icon.svg');
const png = path.join(dist, 'icon.png');

if (!fs.existsSync(svg)) {
  throw new Error('Missing admin-app/icon.svg');
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.copyFileSync(path.join(here, 'index.html'), path.join(dist, 'index.html'));

let converted = false;

try {
  const { default: sharp } = await import('sharp');
  await sharp(fs.readFileSync(svg))
    .resize(1024, 1024)
    .png()
    .toFile(png);
  converted = true;
} catch (error) {
  console.log('sharp unavailable; trying ImageMagick fallback.');
}

if (!converted) {
  const candidates = [
    { cmd: 'magick', args: [svg, '-resize', '1024x1024', png] },
    { cmd: 'convert', args: [svg, '-resize', '1024x1024', png] }
  ];

  for (const candidate of candidates) {
    const result = spawnSync(candidate.cmd, candidate.args, {
      encoding: 'utf8'
    });

    if (!result.error && result.status === 0 && fs.existsSync(png)) {
      converted = true;
      break;
    }
  }
}

if (!converted || !fs.existsSync(png) || fs.statSync(png).size === 0) {
  throw new Error('Icon conversion failed. Check ImageMagick and SVG support.');
}

console.log('Alwaha Admin web build passed.');
