// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { expect, test as base, type Locator, type Page } from '@playwright/test';

/* Every e2e test fails if the page throws or logs an error — the same errors the
   in-app tracker would catch in production. */
export const test = base.extend<{ errors: string[] }>({
  errors: async ({ page }, provide) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await provide(errors);
    expect(errors, 'page errors').toEqual([]);
  },
});

export { expect };

export async function startWithDemo(page: Page) {
  // Hidden presentation mode loads the sample month without any button in the UI.
  await page.goto('./#/?demo=1');
  // Onboarding has its own h1, so wait for it to go and the app navigation to arrive.
  await expect(page.getByRole('heading', { name: /أهلاً في/ })).toHaveCount(0);
  await expect(
    page
      .getByRole('navigation', { name: 'التنقل الرئيسي' })
      .or(page.getByRole('complementary', { name: 'التنقل الرئيسي' }))
      .first(),
  ).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

export async function openCapture(page: Page) {
  // Phone: tab bar button. Tablet/desktop: sidebar button. Both are labelled the same.
  await page.getByRole('button', { name: 'فكرة جديدة' }).first().click();
  await expect(page.getByRole('dialog', { name: 'فكرة جديدة' })).toBeVisible();
}

/* ── Gate helpers ──────────────────────────────────────────────
   Forward moves open the checkpoint («نقطة التفتيش»); these helpers drive it the way a person does. */

/** A hook of 5 words and a script of 30: enough for the script gate. */
export const GOOD_HOOK = 'هذا الخطّاف يوقف السكرول فعلاً';
export const GOOD_BODY = Array.from({ length: 30 }, (_, i) => `كلمة${i + 1}`).join(' ');
export const GOOD_URL = 'https://instagram.com/reel/abc123';

/** Type the hook and script on an open idea page and wait until they are really saved. */
export async function fillScript(
  page: Page,
  { hook = GOOD_HOOK, body = GOOD_BODY }: { hook?: string; body?: string } = {},
) {
  await page.getByRole('textbox', { name: 'الخطّاف' }).fill(hook);
  await page.getByRole('textbox', { name: 'المحتوى' }).fill(body);
  await expect(page.getByRole('status').filter({ hasText: 'محفوظ' })).toBeVisible({
    timeout: 5000,
  });
}

/** Tick every approval box in the open checkpoint, press «اعتماد والانتقال» and wait for it to close. */
export async function passGate(page: Page, opts: { proof?: string; url?: string } = {}) {
  const sheet = page.getByTestId('gate-sheet');
  await expect(sheet).toBeVisible();
  const boxes = sheet.locator('input[type="checkbox"]');
  for (const box of await boxes.all()) if (!(await box.isChecked())) await box.check();
  if (opts.proof !== undefined) await sheet.getByTestId('gate-proof').fill(opts.proof);
  if (opts.url !== undefined) await sheet.getByTestId('gate-url').fill(opts.url);
  const confirm = page.getByTestId('gate-confirm');
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(sheet).toHaveCount(0);
}

/** Use the idea page's «نقل لـ…» button, then pass the checkpoint it opens. */
export async function moveVia(page: Page, label: string, opts?: { proof?: string; url?: string }) {
  await page.getByRole('button', { name: `نقل لـ«${label}»` }).click();
  await passGate(page, opts);
}

/** Capture a new idea (title only; the default platform and format apply) and land on its page. */
export async function createAndOpenIdea(page: Page, title: string) {
  await openCapture(page);
  await page.getByRole('textbox', { name: 'عنوان الفكرة الجديدة' }).fill(title);
  await page.getByRole('button', { name: 'حفظ وفتح' }).click();
  await expect(page).toHaveURL(/#\/idea\//);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'عنوان الفكرة', exact: true })).toHaveValue(title);
}

/** Capture a new idea and carry it all the way through the checkpoints, to the stage `upTo`
    (a label such as «مونتاج»). Leaves the page on the idea. */
export async function completeIdea(
  page: Page,
  title: string,
  upTo: 'كتابة' | 'تصوير' | 'مونتاج' | 'جاهز' | 'منشور' = 'تصوير',
) {
  await createAndOpenIdea(page, title);
  await fillScript(page);
  const path = ['كتابة', 'تصوير', 'مونتاج', 'جاهز', 'منشور'];
  for (const label of path.slice(0, path.indexOf(upTo) + 1)) {
    if (label === 'منشور') {
      await page.getByRole('button', { name: /تم النشر/ }).click();
      await passGate(page);
    } else await moveVia(page, label);
  }
}

/* ── Direct database access (for seeding a state the UI cannot reach, and for proof) ──── */

export interface RawIdea {
  id: string;
  title: string;
  stage: string;
  hook: string;
  body: string;
  cta: string;
  scheduledFor: string | null;
  approvals?: Record<string, number>;
  proof?: string;
  publishedUrl?: string;
  publishedAt: number | null;
  [k: string]: unknown;
}

/** Read every idea straight from IndexedDB. */
export async function dbIdeas(page: Page): Promise<RawIdea[]> {
  return page.evaluate(
    () =>
      new Promise<RawIdea[]>((resolve, reject) => {
        const open = indexedDB.open('kawalees');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const conn = open.result;
          const req = conn.transaction('ideas').objectStore('ideas').getAll();
          req.onsuccess = () => {
            conn.close();
            resolve(req.result as RawIdea[]);
          };
          req.onerror = () => reject(req.error);
        };
      }),
  );
}

export async function dbIdeaByTitle(page: Page, title: string): Promise<RawIdea> {
  const found = (await dbIdeas(page)).find((i) => i.title === title);
  if (!found) throw new Error(`no idea titled «${title}»`);
  return found;
}

/** Write a raw idea record, bypassing every gate: the way an older version (or a damaged file) would. */
export async function dbPutIdea(page: Page, idea: Record<string, unknown>) {
  await page.evaluate(
    (record) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('kawalees');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const conn = open.result;
          const tx = conn.transaction('ideas', 'readwrite');
          tx.objectStore('ideas').put(record);
          tx.oncomplete = () => {
            conn.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    idea,
  );
}

/** A complete raw idea record with sensible defaults. */
export function rawIdea(over: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Date.now();
  return {
    id: `t-${Math.random().toString(36).slice(2, 10)}`,
    title: 'فكرة اختبار',
    notes: '',
    stage: 'idea',
    platforms: ['instagram'],
    format: 'reel',
    pillarId: null,
    spark: 2,
    hook: '',
    body: '',
    cta: '',
    scheduledFor: null,
    scheduledTime: null,
    publishedAt: null,
    archived: false,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

/** Every row of the activity table (one per active day): the source of streaks and the heatmap. */
export async function dbActivity(page: Page): Promise<{ day: string; count: number }[]> {
  return page.evaluate(
    () =>
      new Promise<{ day: string; count: number }[]>((resolve, reject) => {
        const open = indexedDB.open('kawalees');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const conn = open.result;
          const req = conn.transaction('activity').objectStore('activity').getAll();
          req.onsuccess = () => {
            conn.close();
            resolve(req.result as { day: string; count: number }[]);
          };
          req.onerror = () => reject(req.error);
        };
      }),
  );
}

export async function activityTotal(page: Page): Promise<number> {
  return (await dbActivity(page)).reduce((sum, r) => sum + r.count, 0);
}

/** A toast (status or alert) whose text matches. */
export function toastWith(page: Page, text: string | RegExp) {
  return page.locator('[role="status"], [role="alert"]').filter({ hasText: text });
}

/** The line of the checkpoint for one requirement. */
export function gateReq(page: Page, id: string) {
  return page.getByTestId(`gate-req-${id}`);
}

/** Press, move in steps and release with the mouse: how a drag really reaches the drag library. */
export async function dragTo(page: Page, from: Locator, to: Locator) {
  await from.scrollIntoViewIfNeeded();
  const a = await from.boundingBox();
  if (!a) throw new Error('drag source is not on screen');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 12, { steps: 4 });
  const b = await to.boundingBox();
  if (!b) throw new Error('drop target is not on screen');
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 14 });
  await page.waitForTimeout(80);
  await page.mouse.up();
}

/** Day key (YYYY-MM-DD) of today plus `n` days, in the browser's own time zone. */
export async function dayKeyFromToday(page: Page, n: number): Promise<string> {
  return page.evaluate((offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const p = (x: number) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }, n);
}
