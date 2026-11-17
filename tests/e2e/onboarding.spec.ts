// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { expect, test } from './fixtures';

/* First-run safeguards: the start button never leaves the screen on a small phone, and the name
   is already in the database when the next step appears. */

test.describe('welcome screen', () => {
  test('the start button stays in view and the name is saved before the next step', async ({
    page,
    errors: _errors,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('./');
    const start = page.getByRole('button', { name: 'يلا نبدأ' });
    await expect(start).toBeInViewport({ ratio: 1 });
    await start.click();

    await page.getByRole('textbox', { name: 'الاسم' }).fill('ريم');
    await page.getByRole('button', { name: 'التالي' }).click();
    await expect(page.getByRole('heading', { name: 'منصات النشر' })).toBeVisible();

    const saved = await page.evaluate(
      () =>
        new Promise<{ name: string; onboarded: boolean }>((resolve, reject) => {
          const open = indexedDB.open('kawalees');
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const get = open.result.transaction('settings').objectStore('settings').get('me');
            get.onerror = () => reject(get.error);
            get.onsuccess = () => resolve(get.result);
          };
        }),
    );
    expect(saved).toMatchObject({ name: 'ريم', onboarded: false });
  });
});
