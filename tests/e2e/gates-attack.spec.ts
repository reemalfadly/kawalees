// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import {
  activityTotal,
  completeIdea,
  createAndOpenIdea,
  dayKeyFromToday,
  dbIdeaByTitle,
  dbPutIdea,
  expect,
  fillScript,
  gateReq,
  GOOD_BODY,
  GOOD_HOOK,
  moveVia,
  startWithDemo,
  test,
  toastWith,
} from './fixtures';

/* Attacks through the real screens: stale checkpoints, double presses, closing mid-save, undo,
   copies, other time zones, the menu on a card, and a second checkpoint opened over the first.
   Every test ends by reading the database, which is the only judge of what really happened. */

test.describe.configure({ timeout: 90_000 });

/** Overwrite fields of an idea straight in IndexedDB, the way another tab or a damaged file could,
    without telling this tab's live queries. */
async function rawPatch(
  page: import('@playwright/test').Page,
  title: string,
  patch: Record<string, unknown>,
) {
  const current = await dbIdeaByTitle(page, title);
  await dbPutIdea(page, { ...current, ...patch });
}

test.describe('attack: the checkpoint itself', () => {
  test('a checkpoint that went stale (script emptied elsewhere) is refused by the repo, not trusted', async ({
    page,
    errors: _errors,
  }) => {
    await startWithDemo(page);
    const title = 'نقطة تفتيش قديمة';
    await createAndOpenIdea(page, title);
    await fillScript(page);
    await moveVia(page, 'كتابة');

    await page.getByRole('button', { name: 'نقل لـ«تصوير»' }).click();
    await expect(page.getByTestId('gate-sheet')).toBeVisible();
    await expect(page.getByTestId('gate-confirm')).toBeEnabled();

    // Meanwhile, somewhere else, the hook and the script are emptied. This tab is not told.
    await rawPatch(page, title, { hook: '', body: '' });
    await page.getByTestId('gate-confirm').click();

    // The sheet stays open and says why; nothing moved, nothing was announced.
    await expect(page.getByTestId('gate-sheet').getByRole('alert')).toContainText(
      'خطّاف من 3 كلمات',
    );
    await expect(toastWith(page, /انتقلت إلى «تصوير»/)).toHaveCount(0);
    expect((await dbIdeaByTitle(page, title)).stage).toBe('script');
    await expect(page.getByTestId('gate-confirm')).toBeEnabled();
  });

  test('a double press moves once, counts once and announces once', async ({
    page,
    errors: _errors,
  }) => {
    await startWithDemo(page);
    const title = 'ضغط مزدوج';
    await createAndOpenIdea(page, title);
    await fillScript(page);
    await moveVia(page, 'كتابة');
    await expect(toastWith(page, /انتقلت إلى «كتابة»/)).toHaveCount(0, { timeout: 15_000 });
    const before = await activityTotal(page);

    await page.getByRole('button', { name: 'نقل لـ«تصوير»' }).click();
    await expect(page.getByTestId('gate-sheet')).toBeVisible();
    await page.getByTestId('gate-confirm').dblclick();
    await expect(page.getByTestId('gate-sheet')).toHaveCount(0);

    await expect(toastWith(page, /انتقلت إلى «تصوير»/)).toHaveCount(1);
    expect((await dbIdeaByTitle(page, title)).stage).toBe('shoot');
    expect(await activityTotal(page)).toBe(before + 1);

    // Three clicks fired in the same instant behave the same as the double click.
    await page.getByRole('button', { name: 'نقل لـ«مونتاج»' }).click();
    await page.getByTestId('gate-check-approve-shoot').check();
    await page.getByTestId('gate-confirm').evaluate((el) => {
      const button = el as HTMLButtonElement;
      button.click();
      button.click();
      button.click();
    });
    await expect(page.getByTestId('gate-sheet')).toHaveCount(0);
    await expect(toastWith(page, /انتقلت إلى «مونتاج»/)).toHaveCount(1);
    expect((await dbIdeaByTitle(page, title)).stage).toBe('edit');
    expect(await activityTotal(page)).toBe(before + 2);
  });

  test('closing the sheet at the very moment of saving leaves screen and database in agreement', async ({
    page,
    errors: _errors,
  }) => {
    await startWithDemo(page);
    const title = 'إغلاق أثناء الحفظ';
    await createAndOpenIdea(page, title);
    await fillScript(page);
    await moveVia(page, 'كتابة');

    await page.getByRole('button', { name: 'نقل لـ«تصوير»' }).click();
    await expect(page.getByTestId('gate-sheet')).toBeVisible();
    await page.getByTestId('gate-confirm').click({ noWaitAfter: true });
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('gate-sheet')).toHaveCount(0);
    // Whatever the race decided, the stepper shows exactly what the database holds.
    await expect
      .poll(async () => {
        const stage = (await dbIdeaByTitle(page, title)).stage;
        const shown = (await page.locator('[aria-current="step"]').innerText()).trim();
        return `${stage}:${shown}`;
      })
      .toMatch(/^(shoot:تصوير|script:كتابة)$/);
    await page.reload();
    const stage = (await dbIdeaByTitle(page, title)).stage;
    await expect(page.locator('[aria-current="step"]')).toContainText(
      stage === 'shoot' ? 'تصوير' : 'كتابة',
    );
  });

  test('a second checkpoint opened over the first replaces it: only the second idea can move', async ({
    page,
    errors: _errors,
  }) => {
    await startWithDemo(page);
    const first = 'الأولى بنقطة تفتيش';
    const second = 'الثانية بنقطة تفتيش';
    await createAndOpenIdea(page, first);
    await fillScript(page);
    const firstUrl = page.url();
    await page.goto('./#/ideas');
    await createAndOpenIdea(page, second);
    await fillScript(page);
    const secondUrl = page.url();

    await page.goto(firstUrl);
    await expect(page.getByRole('textbox', { name: 'عنوان الفكرة', exact: true })).toHaveValue(
      first,
    );
    await page.getByRole('button', { name: 'نقل لـ«كتابة»' }).click();
    await expect(page.getByTestId('gate-sheet')).toBeVisible();

    // Reach the other idea's page behind the open sheet and press its move button directly.
    await page.evaluate((url) => {
      location.hash = new URL(url).hash;
    }, secondUrl);
    await expect(page.getByRole('textbox', { name: 'عنوان الفكرة', exact: true })).toHaveValue(
      second,
      { timeout: 10_000 },
    );
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('نقل لـ«كتابة»'),
      );
      button?.click();
    });
    await expect(page.getByTestId('gate-sheet')).toHaveCount(1);
    await page.getByTestId('gate-confirm').click();
    await expect(page.getByTestId('gate-sheet')).toHaveCount(0);

    // Exactly one idea moved, and it is the one whose checkpoint was on screen last.
    const stages = [
      (await dbIdeaByTitle(page, first)).stage,
      (await dbIdeaByTitle(page, second)).stage,
    ];
    expect(stages.filter((s) => s === 'script')).toHaveLength(1);
    expect(stages.filter((s) => s === 'idea')).toHaveLength(1);
    expect(stages[1]).toBe('script');
  });
});

test.describe('attack: typing at the same moment as moving', () => {
  test('text typed an instant before pressing the move button is saved first and judged', async ({
    page,
    errors: _errors,
  }) => {
    await startWithDemo(page);
    const title = 'كتابة ثم نقل فوراً';
    await createAndOpenIdea(page, title);
    await moveVia(page, 'كتابة');

    // No waiting for «محفوظ»: the checkpoint must still see exactly what is on screen.
    await page.getByRole('textbox', { name: 'الخطّاف' }).fill(GOOD_HOOK);
    await page.getByRole('textbox', { name: 'المحتوى' }).fill(GOOD_BODY);
    await page.getByRole('button', { name: 'نقل لـ«تصوير»' }).click();
    await expect(page.getByTestId('gate-sheet')).toBeVisible();
    await expect(gateReq(page, 'hook')).toHaveAttribute('data-met', 'true');
    await expect(gateReq(page, 'body')).toHaveAttribute('data-met', 'true');
    await expect(page.getByTestId('gate-confirm')).toBeEnabled();
    await page.getByTestId('gate-confirm').click();
    await expect(page.getByTestId('gate-sheet')).toHaveCount(0);

    const stored = await dbIdeaByTitle(page, title);
    expect(stored.stage).toBe('shoot');
    expect(stored.hook).toBe(GOOD_HOOK);
    expect(stored.body).toBe(GOOD_BODY);
  });

  test('text emptied an instant before the move is judged empty, not as the old text', async ({
    page,
    errors: _errors,
  }) => {
    await startWithDemo(page);
    const title = 'تفريغ ثم نقل فوراً';
    await createAndOpenIdea(page, title);
    await fillScript(page);
    await moveVia(page, 'كتابة');

    await page.getByRole('textbox', { name: 'الخطّاف' }).fill('');
    await page.getByRole('button', { name: 'نقل لـ«تصوير»' }).click();
    await expect(page.getByTestId('gate-sheet')).toBeVisible();
    await expect(gateReq(page, 'hook')).toHaveAttribute('data-met', 'false');
    await expect(page.getByTestId('gate-confirm')).toBeDisabled();
    expect((await dbIdeaByTitle(page, title)).stage).toBe('script');
  });

  test('leaving the idea page right after typing still saves the text', async ({
    page,
    errors: _errors,
  }) => {
    await startWithDemo(page);
    const title = 'خروج بعد الكتابة';
    await createAndOpenIdea(page, title);
    await page.getByRole('textbox', { name: 'الخطّاف' }).fill(GOOD_HOOK);
    await page.goto('./#/ideas');
    await expect.poll(async () => (await dbIdeaByTitle(page, title)).hook).toBe(GOOD_HOOK);
  });
});

test.describe('attack: undo, copies and doors the screens offer', () => {
  test('undoing a backward move runs the gates again and says why when they fail', async ({
    page,
    errors: _errors,
  }) => {
    await startWithDemo(page);
    const title = 'تراجع ثم تفريغ';
    await completeIdea(page, title, 'تصوير');
    await expect(toastWith(page, /انتقلت/)).toHaveCount(0, { timeout: 15_000 });

    // Back to «كتابة» (free), then empty the script elsewhere, then press «تراجع» (= forward again).
    await page.getByRole('button', { name: 'رجوع لـ«كتابة»' }).click();
    const back = toastWith(page, 'انتقلت إلى «كتابة»');
    await expect(back).toBeVisible();
    await rawPatch(page, title, { hook: '', body: '' });
    await back.getByRole('button', { name: 'تراجع' }).click();

    const refused = toastWith(page, 'تعذّر التراجع');
    await expect(refused).toBeVisible();
    await expect(refused).toContainText('خطّاف من 3 كلمات');
    expect((await dbIdeaByTitle(page, title)).stage).toBe('script');

    // The toast offers the checkpoint, which then lists exactly what is missing.
    await refused.getByRole('button', { name: 'نقطة التفتيش' }).click();
    await expect(page.getByTestId('gate-sheet')).toBeVisible();
    await expect(gateReq(page, 'hook')).toHaveAttribute('data-met', 'false');
    await expect(gateReq(page, 'body')).toHaveAttribute('data-met', 'false');
    await expect(page.getByTestId('gate-confirm')).toBeDisabled();
  });

  test('a copy of a published idea is not published and carries no approvals', async ({
    page,
    errors: _errors,
  }) => {
    await startWithDemo(page);
    const title = 'منشورة ثم منسوخة';
    await completeIdea(page, title, 'منشور');
    expect((await dbIdeaByTitle(page, title)).stage).toBe('published');
    await expect(page.getByTestId('approval-log')).toBeVisible();

    await page.getByRole('button', { name: 'خيارات', exact: true }).click();
    await page.getByRole('menuitem', { name: 'نسخة مكررة' }).click();
    await expect(toastWith(page, 'انعملت نسخة')).toBeVisible();
    await page.getByRole('button', { name: 'فتح' }).click();

    await expect(page.getByRole('textbox', { name: 'عنوان الفكرة', exact: true })).toHaveValue(
      `${title} (نسخة)`,
    );
    const copy = await dbIdeaByTitle(page, `${title} (نسخة)`);
    expect(copy.stage).toBe('shoot');
    expect(copy.approvals).toEqual({});
    expect(copy.publishedAt).toBeNull();
    expect(copy.proof).toBeUndefined();
    expect(copy.publishedUrl).toBeUndefined();
    await expect(page.getByTestId('approval-log')).toHaveCount(0);
    await expect(page.locator('[aria-current="step"]')).toContainText('تصوير');
    // Its next step is the same gate as for any idea: a box is needed.
    await page.getByRole('button', { name: 'نقل لـ«مونتاج»' }).click();
    await expect(page.getByTestId('gate-confirm')).toBeDisabled();
  });

  test('the card menu in the list opens the checkpoint too, and moves nothing by itself', async ({
    page,
    errors: _errors,
  }) => {
    await startWithDemo(page);
    const title = 'قائمة البطاقة';
    await createAndOpenIdea(page, title);
    await moveVia(page, 'كتابة');
    await page.goto('./#/ideas');

    const card = page.getByRole('link', { name: new RegExp(title) }).first();
    await expect(card).toBeVisible();
    await page
      .locator('[data-spotlight]')
      .filter({ hasText: title })
      .first()
      .getByRole('button', { name: 'خيارات الفكرة' })
      .click();
    await page.getByRole('menuitem', { name: 'نقل إلى «تصوير»' }).click();
    await expect(page.getByTestId('gate-sheet')).toBeVisible();
    await expect(gateReq(page, 'hook')).toHaveAttribute('data-met', 'false');
    await expect(page.getByTestId('gate-confirm')).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('gate-sheet')).toHaveCount(0);
    await expect(toastWith(page, /انتقلت/)).toHaveCount(0);
    expect((await dbIdeaByTitle(page, title)).stage).toBe('script');
  });

  test('the command palette and the keyboard shortcuts offer no way to move or schedule', async ({
    page,
    isMobile,
    errors: _errors,
  }) => {
    test.skip(isMobile, 'keyboard shortcuts are for desktops and iPad keyboards');
    await startWithDemo(page);
    const title = 'اختصارات لا تحرّك';
    await createAndOpenIdea(page, title);
    const before = await dbIdeaByTitle(page, title);

    await page.keyboard.press('Control+k');
    const palette = page
      .getByRole('dialog', { name: /بحث/ })
      .or(page.getByRole('combobox', { name: 'بحث' }));
    await expect(palette.first()).toBeVisible();
    for (const word of ['نقل', 'انتقال', 'جدولة', 'نشر', 'اعتماد', 'تصوير', 'مونتاج']) {
      await page.getByRole('combobox', { name: 'بحث' }).fill(word);
      // Only ideas can match by name; the group of commands (navigation, theme, reset…) stays empty.
      await expect(page.getByText('تنقّل وأوامر')).toHaveCount(0);
    }
    await page.keyboard.press('Escape');

    // Single keys outside a text field only navigate or open capture; none touches the stage.
    for (const key of ['1', '2', '3', '4', 'n', 'Escape']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(120);
    }
    await page.goto(`./#/idea/${before.id}`);
    await expect(page.getByRole('textbox', { name: 'عنوان الفكرة', exact: true })).toHaveValue(
      title,
    );
    const after = await dbIdeaByTitle(page, title);
    expect(after.stage).toBe(before.stage);
    expect(after.scheduledFor).toBe(before.scheduledFor);
    expect(after.approvals).toEqual(before.approvals);
  });
});

test.describe('attack: time zones at the edge of the date line', () => {
  for (const timezoneId of ['Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
    test.describe(timezoneId, () => {
      test.use({ timezoneId });

      test('a day scheduled for tomorrow is tomorrow on screen, in storage and on the calendar', async ({
        page,
        errors: _errors,
      }) => {
        await startWithDemo(page);
        await page.setViewportSize({ width: 1440, height: 1000 });
        const title = `جدولة ${timezoneId}`;
        await createAndOpenIdea(page, title);
        await fillScript(page);
        await moveVia(page, 'كتابة');

        const tomorrow = await dayKeyFromToday(page, 1);
        await page.getByLabel('تاريخ النشر').fill(tomorrow);
        await expect(page.getByTestId('schedule-label')).toContainText('بكرة');
        await page.getByLabel('وقت النشر').fill('23:30');
        await expect(page.getByTestId('schedule-label')).toContainText('بكرة');
        const stored = await dbIdeaByTitle(page, title);
        expect(stored.scheduledFor).toBe(tomorrow);
        expect(stored.scheduledTime).toBe('23:30');

        // The same idea is on the calendar in the cell of that very day.
        await page.goto('./#/calendar');
        const cell = page.getByRole('gridcell').filter({ hasText: title });
        await expect(cell).toHaveCount(1);
        const dayNumber = Number(tomorrow.slice(8));
        await expect(cell.locator('span').first()).toHaveText(String(dayNumber));

        // And a day that is not today is not wrongly labelled «اليوم».
        const today = await dayKeyFromToday(page, 0);
        expect(today).not.toBe(tomorrow);
        await page.reload();
        await expect(page.getByRole('gridcell').filter({ hasText: title })).toHaveCount(1);
      });
    });
  }
});
