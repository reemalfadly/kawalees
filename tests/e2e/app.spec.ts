import { expect, openCapture, startWithDemo, test } from './fixtures';

test.describe('first run', () => {
  test('onboarding sets up the studio', async ({ page, errors: _errors }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { name: /أهلاً في/ })).toBeVisible();
    await page.getByRole('button', { name: 'يلا نبدأ' }).click();

    await page.getByRole('textbox', { name: 'الاسم' }).fill('ريم');
    await page.getByRole('button', { name: 'الرمز 🎬' }).click();
    await page.getByRole('button', { name: 'التالي' }).click();

    await page.getByRole('button', { name: /يوتيوب/ }).click();
    await page.getByRole('button', { name: 'التالي' }).click();

    await page.getByRole('button', { name: 'زيادة' }).click();
    await expect(page.getByText('4', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: /يلا نبدع/ }).click();

    await expect(page.getByRole('heading', { level: 1 })).toContainText('ريم');
    await expect(page.getByText('هدف النشر الأسبوعي')).toBeVisible();
  });
});

test.describe('ideas', () => {
  test('capture, edit, persist and move through stages', async ({ page, errors: _errors }) => {
    await startWithDemo(page);
    await openCapture(page);
    const title = 'فكرة اختبار تلقائي';
    await page.getByRole('textbox', { name: 'عنوان الفكرة الجديدة' }).fill(title);
    await page.getByRole('button', { name: 'حفظ وفتح' }).click();

    await expect(page).toHaveURL(/#\/idea\//);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'عنوان الفكرة', exact: true })).toHaveValue(
      title,
    );

    await page.getByRole('textbox', { name: 'الخطّاف' }).fill('هذا الخطّاف يوقف السكرول');
    await page.getByRole('textbox', { name: 'المحتوى' }).fill('كلمة '.repeat(30));
    await expect(page.getByRole('status').filter({ hasText: 'محفوظ' })).toBeVisible({
      timeout: 5000,
    });

    await page.reload();
    await expect(page.getByRole('textbox', { name: 'الخطّاف' })).toHaveValue(
      'هذا الخطّاف يوقف السكرول',
    );

    await page.getByRole('button', { name: 'نقل لـ«كتابة»' }).click();
    await expect(page.getByRole('button', { name: 'نقل لـ«تصوير»' })).toBeVisible();
    await expect(page.locator('[aria-current="step"]')).toContainText('كتابة');
  });

  test('search finds ideas regardless of hamza spelling', async ({ page, errors: _errors }) => {
    await startWithDemo(page);
    await page.goto('./#/ideas');
    await page.getByRole('textbox', { name: 'بحث في الأفكار' }).fill('اداة');
    await expect(page.getByRole('link', { name: 'أداة ذكاء اصطناعي غيّرت شغلي' })).toBeVisible();
    await page.getByRole('textbox', { name: 'بحث في الأفكار' }).fill('ما في شي بهالاسم أبداً');
    await expect(page.getByText('ما في نتائج')).toBeVisible();
  });

  test('delete can be undone', async ({ page, errors: _errors }) => {
    await startWithDemo(page);
    await page.goto('./#/ideas');
    const card = page.getByRole('link', { name: 'تحدي 7 أيام مع المتابعين' });
    await expect(card).toBeVisible();
    await card.click();
    await expect(page).toHaveURL(/#\/idea\//);
    await page.getByRole('button', { name: 'خيارات', exact: true }).click();
    await page.getByRole('menuitem', { name: 'حذف الفكرة' }).click();
    await expect(page).toHaveURL(/#\/ideas$/);
    await expect(page.getByRole('link', { name: 'تحدي 7 أيام مع المتابعين' })).toHaveCount(0);
    await page.getByRole('button', { name: 'تراجع' }).click();
    await expect(page.getByRole('link', { name: 'تحدي 7 أيام مع المتابعين' })).toBeVisible();
  });
});

test.describe('every screen renders', () => {
  for (const [route, heading] of [
    ['#/', /./],
    ['#/ideas', 'الأفكار'],
    ['#/ideas?view=board', 'الأفكار'],
    ['#/calendar', 'التقويم'],
    ['#/stats', 'الأرقام'],
    ['#/settings', 'الإعدادات'],
    ['#/nowhere', 'هالصفحة مو موجودة'],
  ] as const) {
    test(`${route}`, async ({ page, errors: _errors }) => {
      await startWithDemo(page);
      await page.goto(`./${route}`);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    });
  }

  test('recap story and teleprompter open and close', async ({ page, errors: _errors }) => {
    await startWithDemo(page);
    await page.goto('./#/recap');
    await expect(page.getByText(/ملخص/).first()).toBeVisible();
    await page.getByRole('button', { name: 'إغلاق' }).click();

    await page.goto('./#/ideas');
    await page.getByRole('link', { name: 'صوّرت محتوى أسبوع كامل في يوم واحد' }).click();
    await page.getByRole('button', { name: 'وضع التصوير', exact: true }).first().click();
    await expect(page).toHaveURL(/prompter/);
    await expect(page.getByText('الخطّاف')).toBeVisible();
    await page.getByRole('button', { name: 'خروج' }).click();
    await expect(page).toHaveURL(/#\/idea\/[^/]+$/);
  });
});

test.describe('settings', () => {
  test('theme and accent apply instantly', async ({ page, errors: _errors }) => {
    await startWithDemo(page);
    await page.goto('./#/settings');
    await page.getByRole('radio', { name: 'فاتح' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByRole('radio', { name: 'نعناع' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'mint');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('the error tracker starts clean', async ({ page, errors: _errors }) => {
    await startWithDemo(page);
    await page.goto('./#/settings');
    await expect(page.getByText('ما في أخطاء ✓')).toBeVisible();
  });
});

test.describe('desktop power features', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard shortcuts are for desktops and iPad keyboards');

  test('command palette navigates and N opens capture', async ({ page, errors: _errors }) => {
    await startWithDemo(page);
    await page.keyboard.press('Control+k');
    await page.getByRole('combobox', { name: 'بحث' }).fill('التقويم');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/calendar/);
    await page.keyboard.press('n');
    await expect(page.getByRole('dialog', { name: 'فكرة جديدة' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'فكرة جديدة' })).toHaveCount(0);
  });

  test('precaches the app shell for offline use', async ({ page, errors: _errors }) => {
    await page.goto('./');
    await page.waitForFunction(
      async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated',
    );
    const listCache = () =>
      page.evaluate(async () => {
        const urls: string[] = [];
        for (const name of await caches.keys()) {
          const cache = await caches.open(name);
          urls.push(...(await cache.keys()).map((r) => new URL(r.url).pathname));
        }
        return urls;
      });
    // Workbox moves entries out of a temporary cache while activating, so poll briefly.
    await expect
      .poll(
        async () => {
          const cached = await listCache();
          return {
            html: cached.some((u) => u.endsWith('/index.html')),
            js: cached.some((u) => /\/assets\/index-.*\.js$/.test(u)),
            fonts: cached.some((u) => u.endsWith('.woff2')),
          };
        },
        { timeout: 15_000 },
      )
      .toEqual({ html: true, js: true, fonts: true });
  });
});

test.describe('install', () => {
  test('home suggests installing and the guide covers every platform', async ({
    page,
    errors: _errors,
  }) => {
    await startWithDemo(page);
    await page.getByRole('button', { name: 'تثبيت', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'تثبيت كواليس على الجهاز' });
    await expect(sheet).toBeVisible();
    for (const [tab, text] of [
      ['آيفون وآيباد', 'إضافة إلى الشاشة الرئيسية'],
      ['أندرويد', 'تثبيت التطبيق'],
      ['ويندوز', 'تحميل البرنامج لويندوز'],
      ['ماك', 'Add to Dock'],
    ] as const) {
      await sheet.getByRole('radio', { name: new RegExp(tab) }).click();
      await expect(sheet.getByText(text).first()).toBeVisible();
    }
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'إخفاء', exact: true }).click();
    await expect(page.getByText('كواليس أحلى كتطبيق على جهازك')).toHaveCount(0);
  });
});

test.describe('demo', () => {
  test('the demo notice leads back to a clean start', async ({ page, errors: _errors }) => {
    await startWithDemo(page);
    await expect(page.getByText('هذي بيانات تجريبية')).toBeVisible();
    await page.getByRole('button', { name: 'البدء من الصفر' }).click();
    const sheet = page.getByRole('dialog', { name: 'البدء من الصفر؟' });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: 'البدء من الصفر' }).click();
    await expect(page.getByRole('heading', { name: /أهلاً في/ })).toBeVisible();
    await expect(sheet).toHaveCount(0);
  });
});

test.describe('prompter voice-follow', () => {
  test('the script follows the voice', async ({ page, errors: _errors }) => {
    // A stand-in recogniser that "hears" the hook one word at a time.
    await page.addInitScript(() => {
      class FakeRecognition {
        lang = '';
        continuous = false;
        interimResults = false;
        onresult: ((e: unknown) => void) | null = null;
        onerror: ((e: unknown) => void) | null = null;
        onend: (() => void) | null = null;
        start() {
          const words = 'صوّرت سبع فيديوهات في يوم واحد'.split(' ');
          let n = 0;
          const tick = () => {
            if (!this.onresult) return;
            n++;
            this.onresult({ results: [[{ transcript: words.slice(0, n).join(' ') }]] });
            if (n < words.length) setTimeout(tick, 150);
          };
          setTimeout(tick, 150);
        }
        abort() {
          this.onresult = null;
        }
      }
      const w = window as unknown as Record<string, unknown>;
      w.SpeechRecognition = FakeRecognition;
      w.webkitSpeechRecognition = FakeRecognition;
    });
    await startWithDemo(page);
    await page.goto('./#/ideas');
    await page.getByRole('link', { name: 'صوّرت محتوى أسبوع كامل في يوم واحد' }).click();
    await page.getByRole('button', { name: 'وضع التصوير', exact: true }).first().click();
    await page.getByRole('button', { name: 'يتبع الصوت' }).click();
    await page.getByRole('button', { name: 'تشغيل' }).click();
    await expect(page.getByText('الاستماع شغال')).toBeVisible();
    await expect(page.locator('[data-said]')).toHaveCount(6, { timeout: 8000 });
  });
});
