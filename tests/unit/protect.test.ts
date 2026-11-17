// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportAndDownload } from '@/lib/backup';
import { db } from '@/lib/db';
import {
  daysSince,
  dismissExportReminder,
  exportReminderDue,
  getLastExportAt,
  getReminderDismissedAt,
  persistAfterFirstIdea,
  REMINDER_DAYS,
  REMINDER_SNOOZE_DAYS,
} from '@/lib/protect';
import { buildErrorReport, trackError } from '@/lib/tracker';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 17, 12);

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('weekly export reminder', () => {
  const base = { now: NOW, lastExportAt: null, oldestIdeaAt: NOW - 3 * DAY, ideaCount: 4 };

  it('stays quiet when there is nothing to lose', () => {
    expect(exportReminderDue({ ...base, ideaCount: 0, dismissedAt: null })).toBe(false);
  });

  it('is due a week after the last export, not before', () => {
    const at = (days: number) => NOW - days * DAY;
    const due = (days: number) =>
      exportReminderDue({ ...base, lastExportAt: at(days), dismissedAt: null });
    expect(due(REMINDER_DAYS - 1)).toBe(false);
    expect(due(REMINDER_DAYS)).toBe(true);
    expect(due(30)).toBe(true);
  });

  it('with no export yet, waits a day after the first idea', () => {
    const due = (oldest: number) =>
      exportReminderDue({ ...base, oldestIdeaAt: oldest, dismissedAt: null });
    expect(due(NOW - 3_600_000)).toBe(false);
    expect(due(NOW - DAY)).toBe(true);
  });

  it('stays closed for two days after being dismissed', () => {
    const input = { ...base, lastExportAt: NOW - 20 * DAY };
    expect(exportReminderDue({ ...input, dismissedAt: NOW - DAY })).toBe(false);
    expect(exportReminderDue({ ...input, dismissedAt: NOW - REMINDER_SNOOZE_DAYS * DAY })).toBe(
      true,
    );
  });

  it('counts whole days', () => {
    expect(daysSince(NOW - 8.9 * DAY, NOW)).toBe(8);
    expect(daysSince(NOW + DAY, NOW)).toBe(0);
  });
});

describe('export records its date', () => {
  it('stores the last export and the dismissal on the device', async () => {
    expect(await getLastExportAt()).toBeNull();
    await dismissExportReminder(123);
    expect(await getReminderDismissedAt()).toBe(123);

    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }),
    );
    const file = await exportAndDownload(new Date(NOW));
    expect(file).toBe('kawalees-backup-2026-11-17.json');
    expect(click).toHaveBeenCalledOnce();
    expect(await getLastExportAt()).toBe(NOW);
  });
});

describe('persistent storage', () => {
  it('asks once, after the first idea, and tolerates browsers without the API', async () => {
    expect(await persistAfterFirstIdea()).toBe(false);
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('navigator', { storage: { persist, persisted: () => Promise.resolve(false) } });
    // Already asked above, so a second launch must not ask again.
    expect(await persistAfterFirstIdea()).toBe(false);
    expect(persist).not.toHaveBeenCalled();

    await db.meta.clear();
    expect(await persistAfterFirstIdea()).toBe(true);
    expect(persist).toHaveBeenCalledOnce();
  });
});

describe('support error report', () => {
  it('lists the latest errors without any idea content', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await trackError(new Error('boom'), 'manual');
    const report = await buildErrorReport();
    expect(report).toContain('Errors: 1');
    expect(report).toContain('boom');
  });
});
