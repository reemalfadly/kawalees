// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import {
  activityTotal,
  createAndOpenIdea,
  dayKeyFromToday,
  dbIdeaByTitle,
  dbIdeas,
  dbPutIdea,
  dragTo,
  expect,
  fillScript,
  GOOD_HOOK,
  GOOD_URL,
  moveVia,
  openCapture,
  passGate,
  rawIdea,
  startWithDemo,
  test,
  toastWith,
  gateReq,
} from './fixtures';

/* The gates between production stages, proved end to end: every claim is checked against what
   really sits in IndexedDB and on screen after the attempt, never just that a control exists. */

// Several journeys through the checkpoints per test: give them room on a busy machine.
test.describe.configure({ timeout: 90_000 });

const words = (n: number, stem = 'كلمة') =>
  Array.from({ length: n }, (_, i) => `${stem}${i + 1}`).join(' ');

test.describe('stage gates: ideas that have nothing yet', () => {
  test('a new empty idea cannot get past «كتابة» and nothing is recorded', async ({
    page,
    errors: _errors,
  }) => {
    await startWithDemo(page);
    await createAndOpenIdea(page, 'فكرة فاضية للاختبار');
    const before = await activityTotal(page);

    // Title, a platform and a format are all there, so the first gate honestly opens.
    await page.getByRole('button', { name: 'نقل لـ«كتابة»' }).click();
    await expect(page.getByTestId('gate-sheet')).toBeVisible();
    await expect(page.getByTestId('gate-confirm')).toBeEnabled();
    await page.getByTestId('gate-confirm').click();
    await expect(page.getByTestId('gate-sheet')).toHaveCount(0);
    await expect(page.locator('[aria-current="step"]')).toContainText('كتابة');
    const afterFirst = await activityTotal(page);

    // The second one has no hook and no script: the checkpoint says what is missing and refuses.
    await page.getByRole('button', { name: 'نقل لـ«تصوير»' }).click();
    const sheet = page.getByTestId('gate-sheet');
    await expect(sheet).toBeVisible();
    await expect(gateReq(page, 'hook')).toHaveAttribute('data-met', 'false');
    await expect(gateReq(page, 'body')).toHaveAttribute('data-met', 'false');
    await expect(page.getByTestId('gate-state-hook')).toContainText('الخطّاف فارغ');
    await expect(page.getByTestId('gate-state-body')).toContainText('المحتوى فارغ');
    await expect(page.getByTestId('gate-confirm')).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);

    // The stepper is another door to the same gate: jumping to «مونتاج» is refused as well.
    await page
      .getByRole('list', { name: 'مراحل الإنتاج' })
      .getByRole('button', { name: 'مونتاج' })
      .click();
    await expect(page.getByTestId('gate-sheet')).toBeVisible();
    await expect(gateReq(page, 'hook')).toHaveAttribute('data-met', 'false');
    await expect(gateReq(page, 'approve-shoot')).toHaveAttribute('data-met', 'false');
    await expect(page.getByTestId('gate-confirm')).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('gate-sheet')).toHaveCount(0);

    // Nothing moved, nothing was announced, nothing was counted.
    await expect(toastWith(page, /انتقلت إلى «تصوير»|انتقلت إلى «مونتاج»/)).toHaveCount(0);
    await expect(page.locator('[aria-current="step"]')).toContainText('كتابة');
    expect((await dbIdeaByTitle(page, 'فكرة فاضية للاختبار')).stage).toBe('script');
    expect(await activityTotal(page)).toBe(afterFirst);
    expect(afterFirst).toBeGreaterThanOrEqual(before);
  });

  test('without a title or a platform even the first step is refused', async ({
    page,
    errors: _errors,
  }) => {
    await startWithDemo(page);
    await openCapture(page);
    await page.getByRole('textbox', { name: 'عنوان الفكرة الجديدة' }).fill('اب');
    const platforms = page.getByRole('group', { name: 'المنصات' });
    for (const chip of await platforms.getByRole('button', { pressed: true }).all())
      await chip.click();
    await page.getByRole('button', { name: 'حفظ وفتح' }).click();
    await expect(page).toHaveURL(/#\/idea\//);

    await page.getByRole('button', { name: 'نقل لـ«كتابة»' }).click();
    await expect(page.getByTestId('gate-sheet')).toBeVisible();
    await expect(gateReq(page, 'title')).toHaveAttribute('data-met', 'false');
    await expect(gateReq(page, 'platform')).toHaveAttribute('data-met', 'false');
    await expect(page.getByTestId('gate-confirm')).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.locator('[aria-current="step"]')).toContainText('فكرة');
    expect((await dbIdeaByTitle(page, 'اب')).stage).toBe('idea');
  });

  test('a «كتابة» idea with an empty hook and script cannot go to «تصوير» or be scheduled', async ({
    page,
    errors: _errors,
  }) => {
    // The owner's case: an idea sitting in «كتابة» with nothing written.
    await startWithDemo(page);
    const title = 'فكرة بلا نص في كتابة';
    await createAndOpenIdea(page, title);
    await moveVia(page, 'كتابة');
    expect((await dbIdeaByTitle(page, title)).stage).toBe('script');

    // 1) The move.
    await page.getByRole('button', { name: 'نقل لـ«تصوير»' }).click();
    await expect(page.getByTestId('gate-confirm')).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('gate-sheet')).toHaveCount(0);

    // 2) The date field on the idea page.
    const day = await dayKeyFromToday(page, 3);
    await page.getByLabel('تاريخ النشر').fill(day);
    await expect(toastWith(page, 'لا يمكن تحديد الموعد بعد')).toBeVisible();
    await expect(page.getByTestId('schedule-label')).toHaveCount(0);
    await expect(page.getByLabel('تاريخ النشر')).toHaveValue('');
    expect((await dbIdeaByTitle(page, title)).scheduledFor).toBeNull();

    // Let that first refusal fade so the next one can only come from the drag.
    await expect(toastWith(page, 'لا يمكن تحديد الموعد بعد')).toHaveCount(0, { timeout: 15_000 });

    // 3) The calendar: the idea sits in the tray with its reason, and a drag onto a day is refused.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('./#/calendar');
    const tray = page.getByLabel(`سحب «${title}» للتقويم`);
    await expect(tray).toBeVisible();
    await expect(tray.getByTestId('tray-blockers')).toContainText('الخطّاف فارغ');
    const cell = page.getByRole('gridcell').filter({ hasNotText: /^$/ }).nth(20);
    await dragTo(page, tray, cell);
    await expect(toastWith(page, 'لا يمكن تحديد الموعد بعد')).toBeVisible();
    await expect(toastWith(page, /انجدولت/)).toHaveCount(0);

    // 4) Nothing is stored and nothing shows as scheduled anywhere.
    const stored = await dbIdeaByTitle(page, title);
    expect(stored.scheduledFor).toBeNull();
    expect(stored.stage).toBe('script');
    await expect(page.getByRole('gridcell').getByText(title)).toHaveCount(0);
    await expect(tray).toBeVisible();
    // Reloading changes nothing: still unscheduled, still waiting in the tray.
    await page.reload();
    await expect(page.getByLabel(`سحب «${title}» للتقويم`)).toBeVisible();
    expect((await dbIdeaByTitle(page, title)).scheduledFor).toBeNull();
  });
});

test.describe('stage gates: the script', () => {
  test('a «___» blank, then 24 words, then 25 words: refused, refused, accepted', async ({
    page,
    errors: _errors,
  }) => {
    await startWithDemo(page);
    const title = 'فكرة فيها فراغات';
    await createAndOpenIdea(page, title);
    await moveVia(page, 'كتابة');

    const open = async () => {
      await page.getByRole('button', { name: 'نقل لـ«تصوير»' }).click();
      await expect(page.getByTestId('gate-sheet')).toBeVisible();
    };
    const close = async () => {
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('gate-sheet')).toHaveCount(0);
    };

    // A blank in the hook (its 5 words are otherwise fine) and a body of 24 words.
    await fillScript(page, { hook: 'هل جربت ___ من قبل أبداً', body: words(24) });
    await open();
    await expect(gateReq(page, 'hook')).toHaveAttribute('data-met', 'true');
    await expect(gateReq(page, 'blank-hook')).toHaveAttribute('data-met', 'false');
    await expect(page.getByTestId('gate-state-blank-hook')).toContainText('___');
    await expect(gateReq(page, 'body')).toHaveAttribute('data-met', 'false');
    await expect(page.getByTestId('gate-state-body')).toContainText('24 من 25');
    await expect(page.getByTestId('gate-confirm')).toBeDisabled();
    await close();

    // The hook is fixed; 24 words are still one short.
    await page.getByRole('textbox', { name: 'الخطّاف' }).fill(GOOD_HOOK);
    await expect(page.getByRole('status').filter({ hasText: 'محفوظ' })).toBeVisible({
      timeout: 5000,
    });
    await open();
    await expect(gateReq(page, 'blank-hook')).toHaveAttribute('data-met', 'true');
    await expect(gateReq(page, 'body')).toHaveAttribute('data-met', 'false');
    await expect(page.getByTestId('gate-confirm')).toBeDisabled();
    // «انتقال للحقل» takes the person to the field that is short.
    await page.getByTestId('gate-go-body').click();
    await expect(page.getByTestId('gate-sheet')).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'المحتوى' })).toBeFocused();
    expect((await dbIdeaByTitle(page, title)).stage).toBe('script');

    // A blank left in the call to action blocks too.
    await fillScript(page, { hook: GOOD_HOOK, body: words(25) });
    const cta = page.getByRole('textbox', { name: 'الدعوة للتفاعل' });
    await cta.fill('اكتبوا ___ في التعليقات');
    await expect(page.getByRole('status').filter({ hasText: 'محفوظ' })).toBeVisible({
      timeout: 5000,
    });
    await open();
    await expect(gateReq(page, 'blank-cta')).toHaveAttribute('data-met', 'false');
    await expect(page.getByTestId('gate-confirm')).toBeDisabled();
    await close();
    await cta.fill('');
    await expect(page.getByRole('status').filter({ hasText: 'محفوظ' })).toBeVisible({
      timeout: 5000,
    });

    // Exactly 25 words, no blanks: the script part is met and the shoot confirmation is next.
    await open();
    await expect(gateReq(page, 'body')).toHaveAttribute('data-met', 'true');
    await expect(gateReq(page, 'hook')).toHaveAttribute('data-met', 'true');
    await passGate(page);
    await expect(page.locator('[aria-current="step"]')).toContainText('تصوير');
    expect((await dbIdeaByTitle(page, title)).stage).toBe('shoot');
  });

  test('Arabic digits and punctuation are counted honestly', async ({ page, errors: _errors }) => {
    await startWithDemo(page);
    const title = 'عدّ الأرقام العربية';
    await createAndOpenIdea(page, title);
    await moveVia(page, 'كتابة');
    // 24 real words plus a stray dash and an ellipsis: still 24.
    await fillScript(page, { hook: GOOD_HOOK, body: `${words(24)} - … ؟` });
    await page.getByRole('button', { name: 'نقل لـ«تصوير»' }).click();
    await expect(page.getByTestId('gate-state-body')).toContainText('24 من 25');
    await expect(page.getByTestId('gate-confirm')).toBeDisabled();
  });
});

test.describe('stage gates: approvals', () => {
  test('each approval needs its box; then it moves and is written in the log', async ({
    page,
    errors: _errors,
  }) => {
    await startWithDemo(page);
    const title = 'فكرة الاعتمادات';
    await createAndOpenIdea(page, title);
    await fillScript(page);
    await moveVia(page, 'كتابة');
    await expect(page.getByTestId('approval-log')).toHaveCount(0);

    // «كتابة» → «تصوير» has no box (the script is the proof). Then three approvals follow.
    await page.getByRole('button', { name: 'نقل لـ«تصوير»' }).click();
    await page.getByTestId('gate-confirm').click();
    await expect(page.getByTestId('gate-sheet')).toHaveCount(0);

    const order = ['shoot', 'edit', 'ready'] as const;
    for (const [i, id] of order.entries()) {
      const label = ['مونتاج', 'جاهز', 'منشور'][i]!;
      const button =
        label === 'منشور'
          ? page.getByRole('button', { name: /تم النشر/ })
          : page.getByRole('button', { name: `نقل لـ«${label}»` });
      await button.click();
      await expect(page.getByTestId('gate-sheet')).toBeVisible();
      // No box, no way forward.
      await expect(page.getByTestId('gate-confirm')).toBeDisabled();
      await expect(gateReq(page, `approve-${id}`)).toHaveAttribute('data-met', 'false');
      const box = page.getByTestId(`gate-check-approve-${id}`);
      await expect(box).not.toBeChecked();
      await box.check();
      await expect(gateReq(page, `approve-${id}`)).toHaveAttribute('data-met', 'true');
      await expect(page.getByTestId('gate-confirm')).toBeEnabled();
      // Unticking again closes the door again.
      await box.uncheck();
      await expect(page.getByTestId('gate-confirm')).toBeDisabled();
      await box.check();
      await page.getByTestId('gate-confirm').click();
      await expect(page.getByTestId('gate-sheet')).toHaveCount(0);

      const stored = await dbIdeaByTitle(page, title);
      expect(stored.approvals?.[id], `approval of ${id} is stored`).toBeGreaterThan(0);
      await expect(page.getByTestId(`approval-${id}`)).toContainText(
        { shoot: 'اعتُمد التصوير', edit: 'اعتُمد المونتاج', ready: 'اعتُمد النشر' }[id],
      );
    }

    const done = await dbIdeaByTitle(page, title);
    expect(done.stage).toBe('published');
    expect(done.publishedAt).toBeGreaterThan(0);
    expect(Object.keys(done.approvals ?? {}).sort()).toEqual(['edit', 'ready', 'shoot']);
    // The three entries, in order, with no links (they are optional).
    await expect(page.getByTestId('approval-log').getByRole('listitem')).toHaveCount(3);
    await expect(page.getByTestId('approval-log')).toContainText('اعتُمد التصوير');
    await expect(page.getByTestId('approval-log')).toContainText('اعتُمد المونتاج');
    await expect(page.getByTestId('approval-log')).toContainText('اعتُمد النشر');
  });

  test('the post link is optional: empty passes, «oops» blocks, a real link is saved and copyable', async ({
    page,
    context,
    errors: _errors,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await startWithDemo(page);

    // A) Empty link: the idea publishes and the log offers to add the link later.
    const bare = 'فكرة بلا رابط';
    await createAndOpenIdea(page, bare);
    await fillScript(page);
    for (const label of ['كتابة', 'تصوير', 'مونتاج', 'جاهز'] as const) await moveVia(page, label);
    await expect(page.locator('[aria-current="step"]')).toContainText('جاهز');
    await page.getByRole('button', { name: /تم النشر/ }).click();
    await page.getByTestId(`gate-check-approve-ready`).check();
    await expect(page.getByTestId('gate-url')).toHaveValue('');
    await expect(page.getByTestId('gate-confirm')).toBeEnabled();
    await page.getByTestId('gate-confirm').click();
    await expect(page.getByTestId('gate-sheet')).toHaveCount(0);
    expect((await dbIdeaByTitle(page, bare)).stage).toBe('published');
    await expect(page.getByTestId('log-publishedUrl-add')).toBeVisible();
    await expect(page.getByTestId('log-publishedUrl-value')).toHaveCount(0);

    // Adding a wrong link afterwards is refused with its reason and stores nothing.
    await page.getByTestId('log-publishedUrl-add').click();
    await page.getByTestId('log-publishedUrl-input').fill('oops');
    await page.getByRole('button', { name: 'حفظ', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'رابط المنشور' })).toBeVisible();
    expect((await dbIdeaByTitle(page, bare)).publishedUrl ?? '').toBe('');
    // A real one is stored and shown.
    await page.getByTestId('log-publishedUrl-input').fill(GOOD_URL);
    await page.getByRole('button', { name: 'حفظ', exact: true }).click();
    await expect(page.getByTestId('log-publishedUrl-value')).toHaveText(GOOD_URL);
    expect((await dbIdeaByTitle(page, bare)).publishedUrl).toBe(GOOD_URL);

    // B) Typed at the checkpoint: «oops» blocks, then a valid link goes through and can be copied.
    const linked = 'فكرة برابط';
    await page.goto('./#/ideas');
    await openCapture(page);
    await page.getByRole('textbox', { name: 'عنوان الفكرة الجديدة' }).fill(linked);
    await page.getByRole('button', { name: 'حفظ وفتح' }).click();
    await expect(page.getByRole('textbox', { name: 'عنوان الفكرة', exact: true })).toHaveValue(
      linked,
    );
    await fillScript(page);
    for (const label of ['كتابة', 'تصوير', 'مونتاج', 'جاهز'] as const) await moveVia(page, label);
    await page.getByRole('button', { name: /تم النشر/ }).click();
    await page.getByTestId('gate-check-approve-ready').check();
    await page.getByTestId('gate-url').fill('oops');
    await expect(gateReq(page, 'published-url')).toHaveAttribute('data-met', 'false');
    await expect(page.getByTestId('gate-confirm')).toBeDisabled();
    await page.getByTestId('gate-url').fill('https://nowhere');
    await expect(page.getByTestId('gate-confirm')).toBeDisabled();
    await page.getByTestId('gate-url').fill(GOOD_URL);
    await expect(page.getByTestId('gate-confirm')).toBeEnabled();
    await page.getByTestId('gate-confirm').click();
    await expect(page.getByTestId('gate-sheet')).toHaveCount(0);

    const stored = await dbIdeaByTitle(page, linked);
    expect(stored.stage).toBe('published');
    expect(stored.publishedUrl).toBe(GOOD_URL);
    await expect(page.getByTestId('log-publishedUrl-value')).toHaveText(GOOD_URL);
    await page.getByRole('button', { name: 'نسخ رابط المنشور' }).click();
    await expect(toastWith(page, 'نُسخ الرابط')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(GOOD_URL);
    await expect(page.getByRole('link', { name: 'فتح رابط المنشور' })).toHaveAttribute(
      'href',
      GOOD_URL,
    );
  });
});

test.describe('stage gates: the board, quick capture and the numbers', () => {
  test('dragging an empty idea from «فكرة» to «منشور» opens the checkpoint and moves nothing; backward is direct', async ({
    page,
    errors: _errors,
  }) => {
    await startWithDemo(page);
    // All six columns on one screen, so a card can be dropped on any of them.
    await page.setViewportSize({ width: 2000, height: 1000 });
    const title = 'فكرة للسحب الطويل';
    await createAndOpenIdea(page, title);
    await page.goto('./#/ideas?view=board');
    const column = (label: string) => page.getByRole('region', { name: new RegExp(`^${label}:`) });
    const card = column('فكرة').getByRole('link', { name: new RegExp(title) });
    await expect(card).toBeVisible();

    await dragTo(page, card, column('منشور'));

    // The checkpoint lists every stage on the way, each with what it still needs.
    await expect(page.getByTestId('gate-sheet')).toBeVisible();
    for (const stage of ['فكرة', 'كتابة', 'تصوير', 'مونتاج', 'جاهز'])
      await expect(page.getByTestId('gate-sheet').getByText(`قبل مغادرة «${stage}»`)).toBeVisible();
    for (const id of ['hook', 'body', 'approve-shoot', 'approve-edit', 'approve-ready'])
      await expect(gateReq(page, id)).toHaveAttribute('data-met', 'false');
    for (const id of ['title', 'platform', 'format'])
      await expect(gateReq(page, id)).toHaveAttribute('data-met', 'true');
    await expect(page.getByTestId('gate-confirm')).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('gate-sheet')).toHaveCount(0);

    // It never moved: still in «فكرة» on screen and in the database, no «نزل للعالم», no confetti toast.
    await expect(column('فكرة').getByRole('link', { name: new RegExp(title) })).toBeVisible();
    await expect(column('منشور').getByRole('link', { name: new RegExp(title) })).toHaveCount(0);
    await expect(toastWith(page, /نزل للعالم|انتقلت إلى/)).toHaveCount(0);
    const stored = await dbIdeaByTitle(page, title);
    expect(stored.stage).toBe('idea');
    expect(stored.publishedAt).toBeNull();
    expect(stored.approvals ?? {}).toEqual({});

    // Backward is free and immediate: no checkpoint.
    const back = 'فكرة تتراجع بالسحب';
    await page.goto('./#/ideas');
    await createAndOpenIdea(page, back);
    await fillScript(page);
    for (const label of ['كتابة', 'تصوير', 'مونتاج'] as const) await moveVia(page, label);
    await page.goto('./#/ideas?view=board');
    // Let the toasts of the setup moves fade, so the next one can only come from the drag.
    await expect(toastWith(page, /انتقلت/)).toHaveCount(0, { timeout: 15_000 });
    const editCard = column('مونتاج').getByRole('link', { name: new RegExp(back) });
    await expect(editCard).toBeVisible();
    await dragTo(page, editCard, column('كتابة'));
    await expect(page.getByTestId('gate-sheet')).toHaveCount(0);
    await expect(toastWith(page, 'انتقلت إلى «كتابة»')).toBeVisible();
    await expect(column('كتابة').getByRole('link', { name: new RegExp(back) })).toBeVisible();
    expect((await dbIdeaByTitle(page, back)).stage).toBe('script');
  });

  test('quick capture from a column and from a day never lands past its gates and says so', async ({
    page,
    errors: _errors,
  }) => {
    await startWithDemo(page);
    // A) The «+» of the «تصوير» column. A title, a platform and a type clear the first gate, so the idea
    // lands in «كتابة» (as far as its gates allow), never in «تصوير», and the sheet says so up front.
    await page.goto('./#/ideas?view=board');
    await page.getByRole('button', { name: 'فكرة جديدة في «تصوير»' }).click();
    const dialog = page.getByRole('dialog', { name: 'فكرة جديدة' });
    const fromColumn = 'التقاط سريع من العمود';
    await dialog.getByRole('textbox', { name: 'عنوان الفكرة الجديدة' }).fill(fromColumn);
    await expect(dialog.getByTestId('capture-stage-note')).toContainText('ستُحفظ في «كتابة» أولاً');
    await dialog.getByRole('button', { name: 'حفظ الفكرة' }).click();
    const honest = toastWith(page, 'حُفظت في «كتابة»');
    await expect(honest).toBeVisible();
    await expect(honest).toContainText('لم تُنقل إلى «تصوير» بعد');
    await expect(honest).toContainText('الخطّاف فارغ');
    await expect(toastWith(page, /انحفظت الفكرة/)).toHaveCount(0);
    const a = await dbIdeaByTitle(page, fromColumn);
    expect(a.stage).toBe('script');
    expect(a.scheduledFor).toBeNull();
    expect(a.approvals).toEqual({});
    await expect(
      page
        .getByRole('region', { name: /^كتابة:/ })
        .getByRole('link', { name: new RegExp(fromColumn) }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('region', { name: /^تصوير:/ })
        .getByRole('link', { name: new RegExp(fromColumn) }),
    ).toHaveCount(0);

    // B) «إضافة لهاليوم» on a calendar day.
    await page.goto('./#/calendar');
    await page.getByRole('button', { name: 'إضافة لهاليوم' }).click();
    const sheet = page.getByRole('dialog', { name: 'فكرة جديدة' });
    await expect(sheet.getByTestId('capture-schedule-note')).toContainText('تُحفظ الآن بلا موعد');
    const fromDay = 'التقاط سريع من اليوم';
    await sheet.getByRole('textbox', { name: 'عنوان الفكرة الجديدة' }).fill(fromDay);
    await sheet.getByRole('button', { name: 'حفظ الفكرة' }).click();
    const noDay = toastWith(page, 'حُفظت في «فكرة»');
    await expect(noDay).toBeVisible();
    await expect(noDay).toContainText('لم يُحفظ الموعد بعد');
    await expect(noDay).toContainText('الخطّاف فارغ');
    const b = await dbIdeaByTitle(page, fromDay);
    expect(b.stage).toBe('idea');
    expect(b.scheduledFor).toBeNull();
    expect(b.scheduledTime).toBeNull();
    await expect(page.getByLabel(`سحب «${fromDay}» للتقويم`)).toBeVisible();
  });

  test('refused attempts leave points, streak, activity and the published counter untouched', async ({
    page,
    errors: _errors,
  }) => {
    await startWithDemo(page);

    const squash = (text: string) => text.replace(/\s+/g, ' ').trim();
    const read = async () => {
      await page.goto('./#/stats');
      await expect(page.getByRole('heading', { level: 1, name: 'الأرقام' })).toBeVisible();
      const grab = async () => ({
        xp: squash(await page.locator('p', { hasText: 'نقطة خبرة' }).first().innerText()),
        streak: squash(await page.getByText('سلسلة الإبداع').locator('xpath=..').innerText()),
        published: squash(await page.getByText('نشرت هالشهر').locator('xpath=..').innerText()),
        achievements: squash(
          await page.getByRole('heading', { name: 'الإنجازات' }).locator('xpath=../..').innerText(),
        ),
      });
      // The numbers animate in; wait until two reads agree.
      let last = await grab();
      await expect
        .poll(async () => {
          const now = await grab();
          const same = JSON.stringify(now) === JSON.stringify(last);
          last = now;
          return same;
        })
        .toBe(true);
      return last;
    };

    const title = 'فكرة لا تتحرك';
    await createAndOpenIdea(page, title);
    const base = await read();
    const baseActivity = await activityTotal(page);

    // Real attempts through every door that leaves «فكرة».
    await page.goto('./#/ideas');
    await page
      .getByRole('link', { name: new RegExp(title) })
      .first()
      .click();
    await expect(page.getByRole('textbox', { name: 'عنوان الفكرة', exact: true })).toHaveValue(
      title,
    );
    await page.getByRole('button', { name: 'نقل لـ«كتابة»' }).click();
    await page.getByTestId('gate-confirm').waitFor();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('gate-sheet')).toHaveCount(0);
    await page
      .getByRole('list', { name: 'مراحل الإنتاج' })
      .getByRole('button', { name: 'منشور' })
      .click();
    await expect(page.getByTestId('gate-confirm')).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('gate-sheet')).toHaveCount(0);
    await page.getByLabel('تاريخ النشر').fill(await dayKeyFromToday(page, 2));
    await expect(toastWith(page, 'لا يمكن تحديد الموعد بعد')).toBeVisible();

    expect((await dbIdeaByTitle(page, title)).stage).toBe('idea');
    expect(await activityTotal(page)).toBe(baseActivity);
    expect(await read()).toEqual(base);

    // Sanity: a real, accepted move does change the numbers, so the comparison above means something.
    await page.goto('./#/ideas');
    await page
      .getByRole('link', { name: new RegExp(title) })
      .first()
      .click();
    await moveVia(page, 'كتابة');
    expect((await read()).xp).not.toBe(base.xp);
  });
});

test.describe('stage gates: older data and backups', () => {
  test('ideas saved before gates are shown as they were and not punished; moving forward is gated', async ({
    page,
    errors: _errors,
  }) => {
    await startWithDemo(page);
    const publishedCount = async () => {
      await page.goto('./#/stats');
      const tile = page.getByText('نشرت هالشهر').locator('xpath=..');
      await expect(tile).toBeVisible();
      let value = Number.NaN;
      await expect
        .poll(async () => {
          const next = Number((await tile.innerText()).match(/\d+/)?.[0] ?? 'NaN');
          const settled = next === value;
          value = next;
          return settled;
        })
        .toBe(true);
      return value;
    };
    const before = await publishedCount();

    // Three records exactly as the previous version wrote them: no approvals field at all.
    const day = await dayKeyFromToday(page, 2);
    const ready = rawIdea({
      title: 'قديمة جاهزة',
      stage: 'ready',
      hook: 'خطّاف قديم محفوظ من قبل',
      body: words(30),
    });
    const published = rawIdea({
      title: 'قديمة منشورة',
      stage: 'published',
      publishedAt: Date.now() - 3_600_000,
    });
    const scheduled = rawIdea({
      title: 'قديمة مجدولة فاضية',
      stage: 'edit',
      scheduledFor: day,
    });
    for (const r of [ready, published, scheduled]) {
      expect('approvals' in r).toBe(false);
      await dbPutIdea(page, r);
    }
    await page.reload();

    // The published one counts, with its honest wording; nothing warns about missing links.
    expect(await publishedCount()).toBe(before + 1);
    await page.goto(`./#/idea/${published.id as string}`);
    await expect(page.getByTestId('stage-status')).toHaveText('نزل للعالم');
    await expect(page.locator('[aria-current="step"]')).toContainText('منشور');
    await expect(page.getByTestId('approval-log')).toHaveCount(0);

    // The scheduled one keeps its day: it is not in the tray of «بدون موعد».
    await page.goto('./#/calendar');
    await expect(page.getByLabel('سحب «قديمة مجدولة فاضية» للتقويم')).toHaveCount(0);
    expect((await dbIdeaByTitle(page, 'قديمة مجدولة فاضية')).scheduledFor).toBe(day);

    // Forward from «جاهز» is still a gated move: the box is needed.
    await page.goto(`./#/idea/${ready.id as string}`);
    await expect(page.locator('[aria-current="step"]')).toContainText('جاهز');
    await page.getByRole('button', { name: /تم النشر/ }).click();
    await expect(gateReq(page, 'approve-ready')).toHaveAttribute('data-met', 'false');
    await expect(page.getByTestId('gate-confirm')).toBeDisabled();
    await page.getByTestId('gate-check-approve-ready').check();
    await page.getByTestId('gate-confirm').click();
    await expect(page.getByTestId('gate-sheet')).toHaveCount(0);
    const moved = await dbIdeaByTitle(page, 'قديمة جاهزة');
    expect(moved.stage).toBe('published');
    expect(Object.keys(moved.approvals ?? {})).toEqual(['ready']);
  });

  test('importing a backup made before gates existed works and changes nothing in the ideas', async ({
    page,
    errors: _errors,
  }) => {
    await startWithDemo(page);
    const now = Date.now();
    const old = (over: Record<string, unknown>) => ({
      id: `old-${Math.random().toString(36).slice(2, 8)}`,
      title: 'x',
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
    });
    const ideas = [
      old({ title: 'نسخة قديمة منشورة', stage: 'published', publishedAt: now - 86_400_000 }),
      old({ title: 'نسخة قديمة في المونتاج', stage: 'edit', hook: 'خطّاف من النسخة القديمة' }),
      old({ title: 'نسخة قديمة مجدولة', stage: 'script', scheduledFor: '2026-12-01' }),
    ];
    const backup = {
      app: 'kawalees',
      schema: 1,
      exportedAt: new Date().toISOString(),
      data: { ideas, pillars: [], stats: [], activity: [], settings: null },
    };

    await page.goto('./#/settings');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'old-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    const confirm = page.getByRole('dialog', { name: 'استيراد النسخة؟' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'استيراد', exact: true }).click();
    await expect(toastWith(page, 'تم الاستيراد')).toBeVisible();

    // Stored exactly as they came: no approvals invented, no stage changed.
    const stored = await dbIdeas(page);
    expect(stored).toHaveLength(3);
    for (const idea of stored) expect('approvals' in idea).toBe(false);
    expect(stored.find((i) => i.title === 'نسخة قديمة منشورة')?.stage).toBe('published');
    expect(stored.find((i) => i.title === 'نسخة قديمة في المونتاج')?.stage).toBe('edit');
    expect(stored.find((i) => i.title === 'نسخة قديمة مجدولة')?.scheduledFor).toBe('2026-12-01');

    // Every screen that reads ideas still renders them (the fixture fails on any page error).
    for (const [route, heading] of [
      ['#/ideas', 'الأفكار'],
      ['#/ideas?view=board', 'الأفكار'],
      ['#/calendar', 'التقويم'],
      ['#/stats', 'الأرقام'],
    ] as const) {
      await page.goto(`./${route}`);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    }
    await page.goto('./#/ideas');
    await expect(page.getByRole('link', { name: /نسخة قديمة منشورة/ })).toBeVisible();
    await page.getByRole('link', { name: /نسخة قديمة في المونتاج/ }).click();
    await expect(page.locator('[aria-current="step"]')).toContainText('مونتاج');
    await expect(page.getByTestId('approval-log')).toHaveCount(0);
  });
});
