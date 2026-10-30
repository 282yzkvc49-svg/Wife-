// Генерация иконок приложения из SVG (sharp). Квадрат без прозрачности — iOS сам скругляет углы.
import sharp from 'sharp';
import fs from 'node:fs';

const svg = (scale = 1) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#dcefe6"/><stop offset="1" stop-color="#f6dfe3"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <g transform="translate(512 540) scale(${scale}) translate(-512 -540)">
    <circle cx="512" cy="560" r="300" fill="#ffffff" opacity="0.55"/>
    <path d="M512 780 C512 680 512 600 512 470" stroke="#2a6c58" stroke-width="44" stroke-linecap="round" fill="none"/>
    <path d="M512 575 C424 575 342 520 330 410 C446 402 512 476 512 575 Z" fill="#2a6c58"/>
    <path d="M512 505 C536 404 616 344 716 356 C708 460 626 516 512 505 Z" fill="#c9788a"/>
  </g>
</svg>`;

const out = process.argv[2] || 'public';
fs.mkdirSync(out, { recursive: true });
const jobs = [
  ['apple-touch-icon.png', 180, 1], ['icon-192.png', 192, 1], ['icon-512.png', 512, 1],
  ['icon-maskable-512.png', 512, 0.72], ['favicon-32.png', 32, 1.1],
];
for (const [name, size, scale] of jobs) {
  await sharp(Buffer.from(svg(scale))).resize(size, size).flatten({ background: '#dcefe6' }).png().toFile(`${out}/${name}`);
}
console.log('Иконки готовы');
