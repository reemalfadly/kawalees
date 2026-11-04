// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
// Captures the store-style screenshots shown in the install dialog on Android
// and desktop (manifest "screenshots"). Run after `npm run build`:
//   npm run screenshots
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'public/screenshots');
mkdirSync(out, { recursive: true });

const server = await preview({ root, preview: { port: 4179, strictPort: true, open: false } });
const base = 'http://localhost:4179/';

const shots = [
  { file: 'phone-home.jpg', w: 390, h: 844, mobile: true, theme: 'dark', route: '' },
  {
    file: 'phone-board.jpg',
    w: 390,
    h: 844,
    mobile: true,
    theme: 'dark',
    route: '#/ideas?view=board',
  },
  { file: 'phone-stats.jpg', w: 390, h: 844, mobile: true, theme: 'light', route: '#/stats' },
  { file: 'desktop-home.jpg', w: 1440, h: 900, mobile: false, theme: 'dark', route: '' },
  { file: 'desktop-stats.jpg', w: 1440, h: 900, mobile: false, theme: 'light', route: '#/stats' },
];

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
});
for (const s of shots) {
  const context = await browser.newContext({
    viewport: { width: s.w, height: s.h },
    deviceScaleFactor: s.mobile ? 2 : 1,
    isMobile: s.mobile,
    hasTouch: s.mobile,
    colorScheme: s.theme,
    locale: 'ar-KW',
    timezoneId: 'Asia/Kuwait',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  await page.goto(base + '#/?demo=1');
  await page.getByRole('heading', { name: /أهلاً في/ }).waitFor({ state: 'detached' });
  // Hide the install and demo notices: the screenshots show the app itself.
  await page.evaluate(() => {
    for (const key of ['kawalees:install-dismissed', 'kawalees:demo-dismissed'])
      localStorage.setItem(key, String(Date.now()));
  });
  await page.goto(base + s.route);
  await page.reload();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: resolve(out, s.file), type: 'jpeg', quality: 82 });
  await context.close();
  console.log('wrote', s.file);
}
await browser.close();
server.httpServer.close();
