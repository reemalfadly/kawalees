import { beforeEach, describe, expect, it } from 'vitest';
import {
  dailySnapshot,
  exportBackup,
  parseBackup,
  restoreBackup,
  restoreSnapshot,
  SNAPSHOT_LIMIT,
  startFresh,
  takeSnapshot,
  wipeAll,
} from '@/lib/backup';
import { db } from '@/lib/db';
import { todayKey } from '@/lib/dates';
import {
  addStat,
  completeOnboarding,
  createIdea,
  deleteIdea,
  deletePillar,
  duplicateIdea,
  getSettings,
  restoreIdea,
  savePillar,
  scheduleIdea,
  setStage,
  updateSettings,
} from '@/lib/repo';
import { isDemoData, loadDemoData } from '@/lib/seed';
import { ERROR_LIMIT, trackError } from '@/lib/tracker';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('ideas', () => {
  it('creates an idea with sensible defaults and records activity', async () => {
    const idea = await createIdea({ title: '  فكرة جديدة  ' });
    expect(idea).toMatchObject({
      title: 'فكرة جديدة',
      stage: 'idea',
      spark: 2,
      format: 'reel',
      archived: false,
    });
    expect((await db.activity.get(todayKey()))?.count).toBe(1);
  });

  it('stamps publishedAt when published and clears it when moved back', async () => {
    const idea = await createIdea({ title: 'x' });
    await setStage(idea.id, 'published');
    expect((await db.ideas.get(idea.id))?.publishedAt).toBeTypeOf('number');
    await setStage(idea.id, 'edit');
    expect((await db.ideas.get(idea.id))?.publishedAt).toBeNull();
  });

  it('schedules and unschedules', async () => {
    const idea = await createIdea({ title: 'x' });
    await scheduleIdea(idea.id, '2026-10-01', '19:30');
    expect(await db.ideas.get(idea.id)).toMatchObject({
      scheduledFor: '2026-10-01',
      scheduledTime: '19:30',
    });
    await scheduleIdea(idea.id, null, '19:30');
    expect(await db.ideas.get(idea.id)).toMatchObject({ scheduledFor: null, scheduledTime: null });
  });

  it('duplicates without carrying over publish or schedule state', async () => {
    const idea = await createIdea({ title: 'أصل', stage: 'published', scheduledFor: '2026-10-01' });
    const copy = await duplicateIdea(idea.id);
    expect(copy).toMatchObject({
      title: 'أصل (نسخة)',
      stage: 'ready',
      publishedAt: null,
      scheduledFor: null,
    });
  });

  it('supports undo after delete', async () => {
    const idea = await createIdea({ title: 'x' });
    const removed = await deleteIdea(idea.id);
    expect(await db.ideas.count()).toBe(0);
    await restoreIdea(removed!);
    expect(await db.ideas.get(idea.id)).toEqual(idea);
  });
});

describe('settings and pillars', () => {
  it('onboards once and seeds default pillars', async () => {
    await completeOnboarding({
      name: 'ريم',
      avatar: '🎬',
      platforms: ['instagram'],
      weeklyGoal: 4,
    });
    const s = await getSettings();
    expect(s).toMatchObject({ name: 'ريم', onboarded: true, weeklyGoal: 4 });
    expect(await db.pillars.count()).toBe(4);
    await completeOnboarding({
      name: 'ريم',
      avatar: '🎬',
      platforms: ['instagram'],
      weeklyGoal: 4,
    });
    expect(await db.pillars.count()).toBe(4);
    await updateSettings({ accent: 'mint' });
    expect((await getSettings()).accent).toBe('mint');
  });

  it('removes a pillar from the ideas that used it', async () => {
    await savePillar({ name: 'تقنية', emoji: '🤖' });
    const pillar = (await db.pillars.toArray())[0]!;
    const idea = await createIdea({ title: 'x', pillarId: pillar.id });
    await deletePillar(pillar.id);
    expect((await db.ideas.get(idea.id))?.pillarId).toBeNull();
  });
});

describe('backups (the data guard)', () => {
  it('exports and restores everything through a validated file', async () => {
    await completeOnboarding({ name: 'ريم', avatar: '✨', platforms: ['tiktok'], weeklyGoal: 2 });
    await createIdea({ title: 'واحد' });
    await addStat({ platform: 'tiktok', date: '2026-09-28', followers: 10, views: null });
    const text = JSON.stringify(await exportBackup());

    await wipeAll();
    expect(await db.ideas.count()).toBe(0);

    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) await restoreBackup(parsed.backup);
    expect(await db.ideas.count()).toBe(1);
    expect(await db.stats.count()).toBe(1);
    expect((await getSettings()).name).toBe('ريم');
  });

  it('rejects malformed or foreign files without touching data', () => {
    expect(parseBackup('not json').ok).toBe(false);
    expect(parseBackup('{"app":"other"}').ok).toBe(false);
    const bad = parseBackup(
      JSON.stringify({
        app: 'kawalees',
        schema: 1,
        exportedAt: '',
        data: {
          ideas: [{ id: 'x', stage: 'nope' }],
          pillars: [],
          stats: [],
          activity: [],
          settings: null,
        },
      }),
    );
    expect(bad).toMatchObject({ ok: false });
  });

  it('takes at most one daily snapshot and keeps the newest ten', async () => {
    await createIdea({ title: 'x' });
    expect(await dailySnapshot()).toBe(true);
    expect(await dailySnapshot()).toBe(false);
    for (let i = 0; i < SNAPSHOT_LIMIT + 3; i++) await takeSnapshot('manual');
    expect(await db.snapshots.count()).toBe(SNAPSHOT_LIMIT);
  });

  it('skips snapshots when there is nothing to protect', async () => {
    expect(await takeSnapshot('manual')).toBeNull();
  });

  it('restores a snapshot and saves the current state first', async () => {
    await createIdea({ title: 'قديمة' });
    const snap = await takeSnapshot('manual');
    await createIdea({ title: 'جديدة' });
    await restoreSnapshot(snap!.id!);
    expect((await db.ideas.toArray()).map((i) => i.title)).toEqual(['قديمة']);
    const reasons = (await db.snapshots.toArray()).map((s) => s.reason);
    expect(reasons).toContain('before-restore');
  });

  it('loads demo data that passes the backup schema', async () => {
    await loadDemoData(new Date(2026, 8, 28));
    const parsed = parseBackup(JSON.stringify(await exportBackup()));
    expect(parsed.ok).toBe(true);
    expect(await db.ideas.count()).toBeGreaterThan(10);
    expect((await getSettings()).onboarded).toBe(true);
  });

  it('recognises demo data and starts fresh with a snapshot to undo from', async () => {
    await createIdea({ title: 'فكرتي الخاصة' });
    expect(isDemoData(await db.ideas.toArray())).toBe(false);
    await loadDemoData(new Date(2026, 8, 28));
    expect(isDemoData(await db.ideas.toArray())).toBe(true);
    await startFresh();
    expect(await db.ideas.count()).toBe(0);
    expect(await db.settings.count()).toBe(0);
    expect((await db.snapshots.toArray()).map((s) => s.reason)).toContain('before-reset');
  });
});

describe('error tracker', () => {
  it('records errors and folds quick repeats into one row', async () => {
    await trackError(new Error('boom'));
    await trackError(new Error('boom'));
    await trackError('other');
    const rows = await db.errors.toArray();
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.message === 'boom')?.count).toBe(2);
  });

  it('ignores ResizeObserver noise and caps the log', async () => {
    await trackError(new Error('ResizeObserver loop completed with undelivered notifications.'));
    expect(await db.errors.count()).toBe(0);
    for (let i = 0; i < ERROR_LIMIT + 5; i++) await trackError(new Error(`e${i}`));
    expect(await db.errors.count()).toBe(ERROR_LIMIT);
  });
});
