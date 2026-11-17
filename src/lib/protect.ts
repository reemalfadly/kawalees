// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { db, requestPersistentStorage } from './db';

/* Keeping the user's ideas safe: when a backup is due, when the browser is asked to keep the
   data, and the small device-level facts those need. Light on purpose (no validator, no React),
   so the app shell can use it on first paint. */

const DAY = 86_400_000;

/** A backup older than this is worth a gentle reminder. */
export const REMINDER_DAYS = 7;
/** After the reminder is closed it stays quiet for this long. */
export const REMINDER_SNOOZE_DAYS = 2;

const LAST_EXPORT = 'lastExportAt';
const REMINDER_DISMISSED = 'exportReminderDismissedAt';
const PERSIST_ASKED = 'persistAsked';

async function readNumber(key: string): Promise<number | null> {
  const row = await db.meta.get(key);
  return typeof row?.value === 'number' ? row.value : null;
}

export const getLastExportAt = () => readNumber(LAST_EXPORT);
export const getReminderDismissedAt = () => readNumber(REMINDER_DISMISSED);

/** Called after every export that actually produced a file. */
export async function markExported(at = Date.now()): Promise<void> {
  await db.meta.put({ key: LAST_EXPORT, value: at });
}

export async function dismissExportReminder(at = Date.now()): Promise<void> {
  await db.meta.put({ key: REMINDER_DISMISSED, value: at });
}

export interface ReminderInput {
  now: number;
  /** When the last backup file was exported, or null if never. */
  lastExportAt: number | null;
  /** When the oldest idea was created, or null with no ideas. */
  oldestIdeaAt: number | null;
  ideaCount: number;
  dismissedAt: number | null;
}

/** Weekly export reminder. With no export yet it waits a day after the first idea, so someone
    who has just started isn't nagged while still looking around. */
export function exportReminderDue(i: ReminderInput): boolean {
  if (i.ideaCount === 0) return false;
  if (i.dismissedAt !== null && i.now - i.dismissedAt < REMINDER_SNOOZE_DAYS * DAY) return false;
  if (i.lastExportAt !== null) return i.now - i.lastExportAt >= REMINDER_DAYS * DAY;
  return i.oldestIdeaAt !== null && i.now - i.oldestIdeaAt >= DAY;
}

/** Whole days since the given time, never negative. */
export function daysSince(at: number, now = Date.now()): number {
  return Math.max(0, Math.floor((now - at) / DAY));
}

/** Asks the browser to keep our data, once, after the first real idea is saved. Where the API is
    missing it quietly does nothing. Settings shows the outcome and offers a retry. */
export async function persistAfterFirstIdea(): Promise<boolean> {
  const asked = await db.meta.get(PERSIST_ASKED);
  if (asked) return false;
  await db.meta.put({ key: PERSIST_ASKED, value: true });
  return requestPersistentStorage();
}
