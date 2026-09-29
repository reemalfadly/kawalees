import { expect, test as base, type Page } from '@playwright/test';

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
  await page.goto('./');
  await page.getByRole('button', { name: 'تجربة التطبيق ببيانات تجريبية' }).click();
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
