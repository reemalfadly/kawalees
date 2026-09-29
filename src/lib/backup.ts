import { db } from './db';
import { backupSchema } from './schema';
import type { Backup, Snapshot, SnapshotReason } from './types';

/* The data guard: exports, validated imports, and automatic snapshots taken
   daily and before every destructive action, so nothing is ever lost for good. */

export const SNAPSHOT_LIMIT = 10;
const DAY = 86_400_000;

export async function exportBackup(): Promise<Backup> {
  const [ideas, pillars, stats, activity, settings] = await Promise.all([
    db.ideas.toArray(),
    db.pillars.toArray(),
    db.stats.toArray(),
    db.activity.toArray(),
    db.settings.get('me'),
  ]);
  return {
    app: 'kawalees',
    schema: 1,
    exportedAt: new Date().toISOString(),
    data: { ideas, pillars, stats, activity, settings: settings ?? null },
  };
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string };

export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'الملف مو بصيغة JSON صحيحة' };
  }
  const result = backupSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path.join('.') || 'الملف';
    return { ok: false, error: `ملف النسخة الاحتياطية فيه خلل عند «${where}»` };
  }
  return { ok: true, backup: result.data };
}

export async function restoreBackup(backup: Backup): Promise<void> {
  const { ideas, pillars, stats, activity, settings } = backup.data;
  await db.transaction(
    'rw',
    [db.ideas, db.pillars, db.stats, db.activity, db.settings],
    async () => {
      await Promise.all([
        db.ideas.clear(),
        db.pillars.clear(),
        db.stats.clear(),
        db.activity.clear(),
      ]);
      await db.ideas.bulkPut(ideas);
      await db.pillars.bulkPut(pillars);
      await db.stats.bulkPut(stats);
      await db.activity.bulkPut(activity);
      if (settings) await db.settings.put(settings);
    },
  );
}

export async function wipeAll(): Promise<void> {
  await db.transaction(
    'rw',
    [db.ideas, db.pillars, db.stats, db.activity, db.settings],
    async () => {
      await Promise.all([
        db.ideas.clear(),
        db.pillars.clear(),
        db.stats.clear(),
        db.activity.clear(),
        db.settings.clear(),
      ]);
    },
  );
}

/** Back to the welcome screen with nothing in it. A snapshot is kept to undo from. */
export async function startFresh(): Promise<void> {
  await takeSnapshot('before-reset');
  await wipeAll();
}

export async function takeSnapshot(reason: SnapshotReason): Promise<Snapshot | null> {
  const backup = await exportBackup();
  if (backup.data.ideas.length === 0 && backup.data.stats.length === 0) return null;
  const snap: Snapshot = {
    at: Date.now(),
    reason,
    counts: { ideas: backup.data.ideas.length, stats: backup.data.stats.length },
    payload: JSON.stringify(backup),
  };
  snap.id = await db.snapshots.add(snap);
  const excess = (await db.snapshots.count()) - SNAPSHOT_LIMIT;
  if (excess > 0) {
    const oldest = await db.snapshots.orderBy('at').limit(excess).primaryKeys();
    await db.snapshots.bulkDelete(oldest);
  }
  return snap;
}

/** Called on launch: at most one automatic snapshot per day. */
export async function dailySnapshot(now = Date.now()): Promise<boolean> {
  const latest = await db.snapshots.orderBy('at').last();
  if (latest && now - latest.at < DAY) return false;
  return (await takeSnapshot('daily')) !== null;
}

export async function restoreSnapshot(id: number): Promise<void> {
  const snap = await db.snapshots.get(id);
  if (!snap) throw new Error('snapshot not found');
  const parsed = parseBackup(snap.payload);
  if (!parsed.ok) throw new Error(parsed.error);
  await takeSnapshot('before-restore');
  await restoreBackup(parsed.backup);
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
