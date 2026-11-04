// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
// Renders the app icon SVG into every PNG size the PWA and iOS need.
// Run with: npm run icons   (uses the Chromium that Playwright already has)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'public');
mkdirSync(out, { recursive: true });

const FROM = '#ff6b3d';
const TO = '#ff3d7f';

/** @param {{ rounded: boolean, scale: number }} o */
function iconSvg({ rounded, scale }) {
  const glyph = `
    <path d="M24 22.2c0-2.4 2.6-3.9 4.7-2.7l15.6 9.1c2 1.2 2 4.1 0 5.3l-15.6 9.1c-2.1 1.2-4.7-.3-4.7-2.7z" fill="#fff"/>
    <path d="M46.5 9.5c.7 3.9 2.1 5.3 6 6-3.9.7-5.3 2.1-6 6-.7-3.9-2.1-5.3-6-6 3.9-.7 5.3-2.1 6-6z" fill="#fff" opacity="0.95"/>`;
  const offset = (64 - 64 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${FROM}"/><stop offset="100%" stop-color="${TO}"/>
    </linearGradient>
    <radialGradient id="sheen" cx="0.3" cy="0.15" r="0.9">
      <stop offset="0%" stop-color="#fff" stop-opacity="0.35"/><stop offset="60%" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="64" height="64" rx="${rounded ? 18 : 0}" fill="url(#bg)"/>
  <rect width="64" height="64" rx="${rounded ? 18 : 0}" fill="url(#sheen)"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">${glyph}</g>
</svg>`;
}

const favicon = iconSvg({ rounded: true, scale: 1 });
writeFileSync(resolve(out, 'favicon.svg'), favicon);

const targets = [
  { file: 'pwa-192.png', size: 192, rounded: true, scale: 1 },
  { file: 'pwa-512.png', size: 512, rounded: true, scale: 1 },
  // Maskable icons get cropped by the OS: full-bleed background, glyph inside the 80% safe zone.
  { file: 'maskable-512.png', size: 512, rounded: false, scale: 0.78 },
  // iOS rounds the corners itself and shows transparency as black, so no radius here.
  { file: 'apple-touch-icon.png', size: 180, rounded: false, scale: 0.86 },
  // Desktop and Android app icon (electron-builder and the Android build read it from build/).
  { file: '../build/icon.png', size: 1024, rounded: true, scale: 1 },
];
mkdirSync(resolve(root, 'build'), { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
});
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  const svg = iconSvg({ rounded: t.rounded, scale: t.scale });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${t.size}" height="${t.size}" `)}</body></html>`,
  );
  await page.screenshot({
    path: resolve(out, t.file),
    omitBackground: true,
    clip: { x: 0, y: 0, width: t.size, height: t.size },
  });
  console.log('wrote', t.file);
}
await browser.close();
