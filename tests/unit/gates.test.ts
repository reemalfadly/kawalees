// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { beforeEach, describe, expect, it } from 'vitest';
import { exportBackup, parseBackup, restoreBackup, wipeAll } from '@/lib/backup';
import { db } from '@/lib/db';
import { todayKey } from '@/lib/dates';
import {
  checkMove,
  checkSchedule,
  effectiveStage,
  getRequirements,
  hasBlank,
  isLegacyIdea,
  isValidProof,
  isValidPublishedUrl,
  publishGatePassed,
  reachableStage,
  type MoveExtras,
} from '@/lib/gates';
import {
  buildIdea,
  createIdea,
  duplicateIdea,
  moveIdeaStage,
  scheduleIdea,
  updateIdea,
  updateProof,
  type IdeaDraft,
} from '@/lib/repo';
import {
  achievements,
  countByStage,
  ideaXp,
  monthRecap,
  publishedDayKey,
  totalXp,
} from '@/lib/stats';
import type { Idea, Stage } from '@/lib/types';

const WORDS_25 = Array.from({ length: 25 }, (_, i) => `كلمة${i}`).join(' ');
const GOOD = {
  title: 'فكرة جيدة',
  platforms: ['instagram' as const],
  hook: 'هل جربت هذه الطريقة قبل اليوم',
  body: WORDS_25,
};
const URL_OK = 'https://instagram.com/reel/abc123';
const ALL_APPROVALS: MoveExtras = {
  approvals: ['shoot', 'edit', 'ready'],
  proof: 'final-cut.mp4',
  publishedUrl: URL_OK,
};

/** A pure gated idea (approvals present). */
function gated(draft: Partial<IdeaDraft> = {}): Idea {
  return buildIdea({ title: 'x', ...draft, approvals: draft.approvals ?? {} });
}

function ids(list: { id: string }[]): string[] {
  return list.map((r) => r.id);
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('small rules', () => {
  it('recognises blank markers', () => {
    expect(hasBlank('ابدأ بـ ___ ثم')).toBe(true);
    expect(hasBlank('خط__ قصير')).toBe(false);
    expect(hasBlank('كلام عادي')).toBe(false);
  });

  it('accepts only real post links', () => {
    for (const ok of [
      'https://instagram.com/reel/abc',
      'http://tiktok.com/@a/video/1',
      '  https://www.youtube.com/shorts/xyz?feature=share  ',
      'https://youtu.be/abc#t=3',
    ])
      expect(isValidPublishedUrl(ok)).toBe(true);
    for (const bad of [
      '',
      'instagram.com/reel/abc',
      'ftp://instagram.com/a',
      'https://localhost',
      'https://',
      'https://.com',
      'https://insta gram.com',
      'تم النشر',
      undefined,
    ])
      expect(isValidPublishedUrl(bad)).toBe(false);
  });

  it('needs at least three characters of proof', () => {
    expect(isValidProof('ab')).toBe(false);
    expect(isValidProof('   ab   ')).toBe(false);
    expect(isValidProof('a.mp4')).toBe(true);
    expect(isValidProof(undefined)).toBe(false);
  });
});

describe('idea → script gate', () => {
  it('keeps an empty idea where it is', () => {
    const idea = gated({ title: '  ', platforms: [] });
    const gate = checkMove(idea, 'script');
    expect(gate.ok).toBe(false);
    expect(ids(gate.missing)).toEqual(['title', 'platform']);
  });

  it('trims the title before counting and wants a platform', () => {
    expect(checkMove(gated({ title: ' ab ', platforms: ['tiktok'] }), 'script').ok).toBe(false);
    expect(checkMove(gated({ title: 'abc', platforms: [] }), 'script').ok).toBe(false);
    expect(checkMove(gated({ title: 'abc', platforms: ['tiktok'] }), 'script').ok).toBe(true);
  });

  it('labels are plain and gender-neutral', () => {
    const labels = getRequirements(gated(), 'published').map((r) => r.label);
    expect(labels.length).toBeGreaterThan(8);
    for (const l of labels) expect(l).not.toMatch(/اكتب|اكتبي|سجّل|ارفع/u);
  });
});

describe('script → shoot gate', () => {
  const base = { ...GOOD, stage: 'script' as const };

  it('refuses a hook without a script', () => {
    const idea = gated({ ...base, body: '' });
    const gate = checkMove(idea, 'shoot');
    expect(gate.ok).toBe(false);
    expect(ids(gate.missing)).toEqual(['body']);
  });

  it('refuses a script without a hook, and a hook that is too short', () => {
    expect(ids(checkMove(gated({ ...base, hook: '' }), 'shoot').missing)).toEqual(['hook']);
    expect(ids(checkMove(gated({ ...base, hook: 'كلمتان فقط' }), 'shoot').missing)).toEqual([
      'hook',
    ]);
  });

  it('wants 25 words in the script, not 24', () => {
    const body24 = WORDS_25.split(' ').slice(0, 24).join(' ');
    expect(checkMove(gated({ ...base, body: body24 }), 'shoot').ok).toBe(false);
    expect(checkMove(gated(base), 'shoot').ok).toBe(true);
  });

  it('refuses ___ in the hook, the script or the call to action', () => {
    const blankHook = checkMove(gated({ ...base, hook: 'هل جربت ___ قبل اليوم' }), 'shoot');
    expect(ids(blankHook.missing)).toEqual(['blank-hook']);
    const blankBody = checkMove(gated({ ...base, body: `${WORDS_25} ___` }), 'shoot');
    expect(ids(blankBody.missing)).toEqual(['blank-body']);
    const blankCta = checkMove(gated({ ...base, cta: 'تابعوا ___' }), 'shoot');
    expect(ids(blankCta.missing)).toEqual(['blank-cta']);
  });

  it('treats the call to action as optional when it is empty', () => {
    expect(checkMove(gated({ ...base, cta: '' }), 'shoot').ok).toBe(true);
    expect(checkMove(gated({ ...base, cta: 'احفظوا المنشور' }), 'shoot').ok).toBe(true);
  });
});

describe('approval gates', () => {
  it('shoot → edit needs an explicit approval, stamped with its time', async () => {
    const idea = await createIdea({ ...GOOD, stage: 'shoot' });
    expect(idea.stage).toBe('shoot');
    const refused = await moveIdeaStage(idea.id, 'edit');
    expect(refused.ok).toBe(false);
    expect(ids(refused.missing)).toEqual(['approve-shoot']);
    expect((await db.ideas.get(idea.id))?.stage).toBe('shoot');

    const ok = await moveIdeaStage(idea.id, 'edit', { approvals: ['shoot'] }, 1_700_000_000_000);
    expect(ok.ok).toBe(true);
    expect((await db.ideas.get(idea.id))?.approvals).toEqual({ shoot: 1_700_000_000_000 });
  });

  it('edit → ready needs the approval; a too-short proof blocks it', async () => {
    const idea = await createIdea({ ...GOOD, stage: 'shoot' });
    await moveIdeaStage(idea.id, 'edit', { approvals: ['shoot'] });
    const noApproval = await moveIdeaStage(idea.id, 'ready', { proof: 'cut.mp4' });
    expect(ids(noApproval.missing)).toEqual(['approve-edit']);
    const nothing = await moveIdeaStage(idea.id, 'ready');
    expect(ids(nothing.missing)).toEqual(['approve-edit']);
    const shortProof = await moveIdeaStage(idea.id, 'ready', { approvals: ['edit'], proof: 'ab' });
    expect(ids(shortProof.missing)).toEqual(['proof']);
    expect(shortProof.missing[0]).toMatchObject({ met: false, kind: 'proof', stage: 'edit' });
    expect((await db.ideas.get(idea.id))?.stage).toBe('edit');

    const ok = await moveIdeaStage(idea.id, 'ready', { approvals: ['edit'], proof: ' cut.mp4 ' });
    expect(ok.ok).toBe(true);
    expect(await db.ideas.get(idea.id)).toMatchObject({ stage: 'ready', proof: 'cut.mp4' });
  });

  it('edit → ready by approval alone, with no proof at all', async () => {
    const idea = await createIdea({ ...GOOD, stage: 'shoot' });
    await moveIdeaStage(idea.id, 'edit', { approvals: ['shoot'] });
    const ok = await moveIdeaStage(idea.id, 'ready', { approvals: ['edit'] });
    expect(ok).toMatchObject({ ok: true, missing: [] });
    const saved = await db.ideas.get(idea.id);
    expect(saved?.stage).toBe('ready');
    expect(saved?.proof).toBeUndefined();
    expect(Object.keys(saved?.approvals ?? {}).sort()).toEqual(['edit', 'shoot']);
  });

  it('treats a blank proof as no proof', async () => {
    const idea = await createIdea({ ...GOOD, stage: 'shoot' });
    await moveIdeaStage(idea.id, 'edit', { approvals: ['shoot'] });
    const ok = await moveIdeaStage(idea.id, 'ready', { approvals: ['edit'], proof: '   ' });
    expect(ok.ok).toBe(true);
    expect((await db.ideas.get(idea.id))?.stage).toBe('ready');
  });

  it('shows a proof requirement only when a too-short one was typed', () => {
    const idea = gated({ ...GOOD, stage: 'edit' });
    expect(ids(getRequirements(idea, 'ready'))).toEqual(['approve-edit']);
    expect(ids(getRequirements(idea, 'ready', { proof: 'ab' }))).toEqual(['approve-edit', 'proof']);
    expect(ids(getRequirements(idea, 'ready', { proof: 'abc' }))).toEqual(['approve-edit']);
  });

  it('ready → published needs the approval; a typed link must be real', async () => {
    const idea = await createIdea({ ...GOOD, stage: 'shoot' });
    await moveIdeaStage(idea.id, 'ready', {
      approvals: ['shoot', 'edit'],
      proof: 'cut.mp4',
    });
    for (const publishedUrl of ['instagram.com/x', 'ftp://a.com/x', 'https://localhost']) {
      const bad = await moveIdeaStage(idea.id, 'published', {
        approvals: ['ready'],
        publishedUrl,
      });
      expect(ids(bad.missing)).toEqual(['published-url']);
      expect(bad.missing[0]).toMatchObject({ met: false, kind: 'url', stage: 'ready' });
    }
    const noApproval = await moveIdeaStage(idea.id, 'published', { publishedUrl: URL_OK });
    expect(ids(noApproval.missing)).toEqual(['approve-ready']);
    expect((await db.ideas.get(idea.id))?.publishedAt).toBeNull();

    const ok = await moveIdeaStage(idea.id, 'published', {
      approvals: ['ready'],
      publishedUrl: URL_OK,
    });
    expect(ok.ok).toBe(true);
    const saved = await db.ideas.get(idea.id);
    expect(saved).toMatchObject({ stage: 'published', publishedUrl: URL_OK });
    expect(saved?.publishedAt).toBeTypeOf('number');
  });

  it('ready → published by approval alone, with no link', async () => {
    const idea = await createIdea({ ...GOOD, stage: 'shoot' });
    await moveIdeaStage(idea.id, 'ready', { approvals: ['shoot', 'edit'] });
    const ok = await moveIdeaStage(idea.id, 'published', { approvals: ['ready'] });
    expect(ok).toMatchObject({ ok: true, missing: [] });
    const saved = await db.ideas.get(idea.id);
    expect(saved?.stage).toBe('published');
    expect(saved?.publishedUrl).toBeUndefined();
    expect(saved?.publishedAt).toBeTypeOf('number');
    expect(publishGatePassed(saved!)).toBe(true);
  });

  it('treats an empty or blank link as no link', async () => {
    for (const publishedUrl of ['', '   ']) {
      const idea = await createIdea({ ...GOOD, stage: 'shoot' });
      await moveIdeaStage(idea.id, 'ready', { approvals: ['shoot', 'edit'] });
      const ok = await moveIdeaStage(idea.id, 'published', { approvals: ['ready'], publishedUrl });
      expect(ok.ok).toBe(true);
    }
  });

  it('keeps a valid link, trimmed', async () => {
    const idea = await createIdea({ ...GOOD, stage: 'shoot' });
    await moveIdeaStage(idea.id, 'ready', { approvals: ['shoot', 'edit'] });
    const ok = await moveIdeaStage(idea.id, 'published', {
      approvals: ['ready'],
      publishedUrl: `  ${URL_OK}  `,
    });
    expect(ok.ok).toBe(true);
    expect((await db.ideas.get(idea.id))?.publishedUrl).toBe(URL_OK);
  });

  it('approves only the stages being crossed', async () => {
    const idea = await createIdea({ ...GOOD, stage: 'shoot' });
    await moveIdeaStage(idea.id, 'edit', { approvals: ['shoot', 'edit', 'ready'] });
    expect(Object.keys((await db.ideas.get(idea.id))?.approvals ?? {})).toEqual(['shoot']);
  });

  it('ignores proof and link that belong to gates not being crossed', async () => {
    const idea = await createIdea({ ...GOOD, stage: 'shoot' });
    await moveIdeaStage(idea.id, 'edit', {
      approvals: ['shoot'],
      proof: 'early.mp4',
      publishedUrl: URL_OK,
    });
    const saved = await db.ideas.get(idea.id);
    expect(saved?.proof).toBeUndefined();
    expect(saved?.publishedUrl).toBeUndefined();
  });
});

describe('jumping several stages', () => {
  it('lists every gap on the way, in order, and writes nothing', async () => {
    const idea = await createIdea({ title: 'عنوان' });
    const before = await db.ideas.get(idea.id);
    const result = await moveIdeaStage(idea.id, 'published');
    expect(result.ok).toBe(false);
    expect(ids(result.missing)).toEqual([
      'platform',
      'hook',
      'body',
      'approve-shoot',
      'approve-edit',
      'approve-ready',
    ]);
    expect(await db.ideas.get(idea.id)).toEqual(before);
  });

  it('needs the approvals of the middle stages too', async () => {
    const idea = await createIdea({ ...GOOD, stage: 'shoot' });
    const result = await moveIdeaStage(idea.id, 'published', {
      approvals: ['ready'],
      publishedUrl: URL_OK,
    });
    expect(ids(result.missing)).toEqual(['approve-shoot', 'approve-edit']);
  });

  it('goes through when everything is supplied at once', async () => {
    const idea = await createIdea(GOOD);
    expect(idea.stage).toBe('idea');
    const result = await moveIdeaStage(idea.id, 'published', ALL_APPROVALS);
    expect(result.ok).toBe(true);
    const saved = await db.ideas.get(idea.id);
    expect(saved?.stage).toBe('published');
    expect(Object.keys(saved?.approvals ?? {}).sort()).toEqual(['edit', 'ready', 'shoot']);
  });

  it('shows a preview of what would be left once extras are supplied', () => {
    const idea = gated({ ...GOOD, stage: 'shoot' });
    const unmet = (extras?: MoveExtras) =>
      getRequirements(idea, 'published', extras)
        .filter((r) => !r.met)
        .map((r) => r.id);
    expect(unmet()).toEqual(['approve-shoot', 'approve-edit', 'approve-ready']);
    expect(unmet(ALL_APPROVALS)).toEqual([]);
    const all: Stage[] = ['shoot', 'edit', 'ready'];
    expect(unmet({ approvals: all })).toEqual([]);
    expect(unmet({ approvals: all, proof: 'ab' })).toEqual(['proof']);
    expect(unmet({ approvals: all, publishedUrl: 'oops' })).toEqual(['published-url']);
  });
});

describe('going back', () => {
  it('is always allowed, even for an empty idea', async () => {
    const idea = await createIdea({ title: 'x' });
    // A record that somehow sits late with nothing filled in (older data).
    await db.ideas.update(idea.id, { stage: 'published', publishedAt: 1, approvals: undefined });
    for (const stage of ['ready', 'edit', 'shoot', 'script', 'idea'] as const) {
      const result = await moveIdeaStage(idea.id, stage);
      expect(result).toMatchObject({ ok: true, missing: [] });
      expect((await db.ideas.get(idea.id))?.stage).toBe(stage);
    }
    expect((await db.ideas.get(idea.id))?.publishedAt).toBeNull();
  });

  it('gives no requirements and no activity', async () => {
    expect(getRequirements(gated({ stage: 'edit' }), 'idea')).toEqual([]);
    const idea = await createIdea({ ...GOOD, stage: 'shoot' });
    const before = (await db.activity.get(todayKey()))?.count;
    await moveIdeaStage(idea.id, 'idea');
    expect((await db.activity.get(todayKey()))?.count).toBe(before);
  });

  it('keeps earlier approvals so going forward again is not a second ceremony', async () => {
    const idea = await createIdea(GOOD);
    await moveIdeaStage(idea.id, 'edit', { approvals: ['shoot'] });
    await moveIdeaStage(idea.id, 'shoot');
    const again = await moveIdeaStage(idea.id, 'edit');
    expect(again.ok).toBe(true);
  });
});

describe('scheduling', () => {
  it('refuses an empty idea and says why', async () => {
    const idea = await createIdea({ title: 'x' });
    const result = await scheduleIdea(idea.id, '2026-10-01', '19:30');
    expect(result.ok).toBe(false);
    expect(ids(result.missing)).toEqual(['hook', 'body']);
    expect(await db.ideas.get(idea.id)).toMatchObject({ scheduledFor: null, scheduledTime: null });
  });

  it('refuses blanks and accepts a real script', async () => {
    const idea = await createIdea({ ...GOOD, hook: 'هل جربت ___ قبل اليوم' });
    expect((await scheduleIdea(idea.id, '2026-10-01')).ok).toBe(false);
    await updateIdea(idea.id, { hook: GOOD.hook });
    const ok = await scheduleIdea(idea.id, '2026-10-01', '19:30');
    expect(ok.ok).toBe(true);
    expect(await db.ideas.get(idea.id)).toMatchObject({
      scheduledFor: '2026-10-01',
      scheduledTime: '19:30',
    });
  });

  it('always lets a day be removed', async () => {
    const idea = await createIdea(GOOD);
    await scheduleIdea(idea.id, '2026-10-01');
    // The script is wiped afterwards; unscheduling must still work.
    await updateIdea(idea.id, { hook: '', body: '' });
    expect((await scheduleIdea(idea.id, null)).ok).toBe(true);
    expect((await db.ideas.get(idea.id))?.scheduledFor).toBeNull();
  });

  it('lets the time change on a day the idea already has', async () => {
    const idea = await createIdea(GOOD);
    await scheduleIdea(idea.id, '2026-10-01', '10:00');
    await updateIdea(idea.id, { hook: '' });
    expect((await scheduleIdea(idea.id, '2026-10-01', '11:00')).ok).toBe(true);
    expect((await scheduleIdea(idea.id, '2026-10-02', '11:00')).ok).toBe(false);
  });

  it('rejects malformed days and times', async () => {
    const idea = await createIdea(GOOD);
    expect((await scheduleIdea(idea.id, 'غدا')).ok).toBe(false);
    expect((await scheduleIdea(idea.id, '2026-10-01', '7pm')).ok).toBe(false);
  });

  it('gives schedule checks as a pure function too', () => {
    expect(checkSchedule(gated(GOOD)).ok).toBe(true);
    expect(checkSchedule(gated({ title: 'x' })).missing.length).toBe(2);
  });

  it('adds no activity for a refused schedule', async () => {
    const idea = await createIdea({ title: 'x' });
    const before = (await db.activity.get(todayKey()))?.count;
    await scheduleIdea(idea.id, '2026-10-01');
    expect((await db.activity.get(todayKey()))?.count).toBe(before);
  });
});

describe('creating and duplicating', () => {
  it('lands an empty idea in «فكرة» whatever stage or day was asked for', async () => {
    const idea = await createIdea({ title: 'x', stage: 'published', scheduledFor: '2026-10-01' });
    expect(idea).toMatchObject({
      stage: 'idea',
      scheduledFor: null,
      publishedAt: null,
      approvals: {},
    });
  });

  it('keeps as much as the gates allow, never past approvals', async () => {
    const idea = await createIdea({ ...GOOD, stage: 'published', scheduledFor: '2026-10-01' });
    expect(idea).toMatchObject({ stage: 'shoot', scheduledFor: '2026-10-01' });
    expect(reachableStage(idea, 'published')).toBe('shoot');
  });

  it('drops publish data smuggled in through a draft', async () => {
    const idea = await createIdea({
      ...GOOD,
      approvals: { shoot: 1, edit: 1, ready: 1 },
      proof: 'x.mp4',
      publishedUrl: URL_OK,
    });
    expect(idea.approvals).toEqual({});
    expect(idea.proof).toBeUndefined();
    expect(idea.publishedUrl).toBeUndefined();
  });

  it('gives a copy its own empty approvals', async () => {
    const idea = await createIdea(GOOD);
    await moveIdeaStage(idea.id, 'published', ALL_APPROVALS);
    const copy = await duplicateIdea(idea.id);
    expect(copy?.approvals).toEqual({});
    expect(copy?.stage).toBe('shoot');
  });
});

describe('editing is not a back door', () => {
  it('ignores stage, schedule, approvals and proof in updateIdea', async () => {
    const idea = await createIdea({ title: 'x' });
    const sneaky = {
      stage: 'published',
      publishedAt: 5,
      scheduledFor: '2026-10-01',
      scheduledTime: '10:00',
      approvals: { shoot: 1, edit: 1, ready: 1 },
      proof: 'x.mp4',
      publishedUrl: URL_OK,
      title: 'عنوان جديد',
    };
    await updateIdea(idea.id, sneaky as never);
    const saved = await db.ideas.get(idea.id);
    expect(saved).toMatchObject({
      title: 'عنوان جديد',
      stage: 'idea',
      publishedAt: null,
      scheduledFor: null,
      approvals: {},
    });
    expect(saved?.proof).toBeUndefined();
  });

  it('validates proof and link edits afterwards', async () => {
    const idea = await createIdea(GOOD);
    await moveIdeaStage(idea.id, 'published', ALL_APPROVALS);
    const bad = await updateProof(idea.id, { publishedUrl: 'not a link' });
    expect(ids(bad.missing)).toEqual(['published-url']);
    expect((await db.ideas.get(idea.id))?.publishedUrl).toBe(URL_OK);
    const fixed = await updateProof(idea.id, { publishedUrl: 'https://tiktok.com/@a/video/9' });
    expect(fixed.ok).toBe(true);
    expect((await db.ideas.get(idea.id))?.publishedUrl).toBe('https://tiktok.com/@a/video/9');
  });
});

describe('no points for a refused step', () => {
  it('leaves stage, XP and activity exactly as they were', async () => {
    const idea = await createIdea({ title: 'عنوان' });
    const activityBefore = (await db.activity.get(todayKey()))?.count;
    const xpBefore = totalXp(await db.ideas.toArray(), []);
    for (const target of ['script', 'shoot', 'edit', 'ready', 'published'] as const)
      expect((await moveIdeaStage(idea.id, target)).ok).toBe(false);
    expect((await db.activity.get(todayKey()))?.count).toBe(activityBefore);
    expect(totalXp(await db.ideas.toArray(), [])).toBe(xpBefore);
  });

  it('counts a real publish once, with activity for the day', async () => {
    const idea = await createIdea(GOOD);
    const before = (await db.activity.get(todayKey()))?.count ?? 0;
    await moveIdeaStage(idea.id, 'published', ALL_APPROVALS);
    expect((await db.activity.get(todayKey()))?.count).toBe(before + 1);
  });

  it('does not count a published record that never passed the gate', () => {
    const fake = gated({ stage: 'published', publishedAt: new Date(2026, 8, 20).getTime() });
    expect(publishGatePassed(fake)).toBe(false);
    expect(effectiveStage(fake)).toBe('ready');
    expect(publishedDayKey(fake)).toBeNull();
    expect(ideaXp(fake)).toBe(ideaXp({ ...fake, stage: 'ready' }));
    expect(countByStage([fake]).published).toBe(0);
    const ctx = {
      ideas: [fake],
      stats: [],
      activeDays: [],
      weeklyGoal: 1,
      weekStartsOn: 0 as const,
      now: new Date(2026, 8, 28),
    };
    expect(achievements(ctx).find((a) => a.id === 'first-publish')?.unlocked).toBe(false);
    expect(monthRecap([fake], [], [], 2026, 8).published).toBe(0);
  });

  it('counts a publish on the ready approval alone, with no proof or link', () => {
    const at = new Date(2026, 8, 20).getTime();
    const approvedOnly = gated({ stage: 'published', publishedAt: at, approvals: { ready: 3 } });
    expect(approvedOnly.proof).toBeUndefined();
    expect(approvedOnly.publishedUrl).toBeUndefined();
    expect(publishGatePassed(approvedOnly)).toBe(true);
    expect(monthRecap([approvedOnly], [], [], 2026, 8).published).toBe(1);
    const noReady = gated({
      stage: 'published',
      publishedAt: at,
      approvals: { shoot: 1, edit: 2 },
      proof: 'cut.mp4',
      publishedUrl: URL_OK,
    });
    expect(publishGatePassed(noReady)).toBe(false);
    expect(effectiveStage(noReady)).toBe('ready');
  });

  it('does count a gated publish that has its approval and link', () => {
    const real = gated({
      stage: 'published',
      publishedAt: new Date(2026, 8, 20).getTime(),
      approvals: { shoot: 1, edit: 2, ready: 3 },
      proof: 'cut.mp4',
      publishedUrl: URL_OK,
    });
    expect(publishGatePassed(real)).toBe(true);
    expect(publishedDayKey(real)).toBe('2026-09-20');
    expect(monthRecap([real], [], [], 2026, 8).published).toBe(1);
  });
});

describe('older data is never judged retroactively', () => {
  const OLD_IDEA = {
    id: 'old-1',
    title: '',
    notes: '',
    stage: 'published',
    platforms: [],
    format: 'reel',
    pillarId: null,
    spark: 2,
    hook: '',
    body: '',
    cta: '',
    scheduledFor: '2026-09-01',
    scheduledTime: null,
    publishedAt: new Date(2026, 8, 1, 20).getTime(),
    archived: false,
    createdAt: 1,
    updatedAt: 2,
  };
  const OLD_BACKUP = {
    app: 'kawalees',
    schema: 1,
    exportedAt: '2026-09-02T00:00:00.000Z',
    data: { ideas: [OLD_IDEA], pillars: [], stats: [], activity: [], settings: null },
  };

  it('imports a backup without any gate fields', async () => {
    const parsed = parseBackup(JSON.stringify(OLD_BACKUP));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await restoreBackup(parsed.backup);
    const saved = (await db.ideas.get('old-1'))!;
    expect(saved).toMatchObject({ stage: 'published', scheduledFor: '2026-09-01', title: '' });
    expect(isLegacyIdea(saved)).toBe(true);
  });

  it('still counts old published ideas with no link', async () => {
    const parsed = parseBackup(JSON.stringify(OLD_BACKUP));
    if (!parsed.ok) throw new Error('unreachable');
    const [old] = parsed.backup.data.ideas;
    expect(publishGatePassed(old!)).toBe(true);
    expect(publishedDayKey(old!)).toBe('2026-09-01');
    expect(ideaXp(old!)).toBeGreaterThanOrEqual(100);
    expect(countByStage([old!]).published).toBe(1);
  });

  it('lets old data be moved back and rescheduled-off without any ceremony', async () => {
    await db.ideas.put(OLD_IDEA as Idea);
    expect((await moveIdeaStage('old-1', 'edit')).ok).toBe(true);
    expect((await scheduleIdea('old-1', null)).ok).toBe(true);
  });

  it('applies the gates to old data only when it moves forward or gets a new day', async () => {
    await db.ideas.put({ ...OLD_IDEA, stage: 'edit', publishedAt: null } as Idea);
    const forward = await moveIdeaStage('old-1', 'ready');
    expect(ids(forward.missing)).toEqual(['approve-edit']);
    expect((await scheduleIdea('old-1', '2026-11-01')).ok).toBe(false);
    // An existing day is untouched; only a new or changed day is checked.
    expect((await db.ideas.get('old-1'))?.scheduledFor).toBe('2026-09-01');
  });

  it('round-trips the new fields through export and import', async () => {
    const idea = await createIdea(GOOD);
    await moveIdeaStage(idea.id, 'published', ALL_APPROVALS);
    const text = JSON.stringify(await exportBackup());
    await wipeAll();
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) await restoreBackup(parsed.backup);
    const saved = await db.ideas.get(idea.id);
    expect(saved).toMatchObject({ proof: 'final-cut.mp4', publishedUrl: URL_OK });
    expect(Object.keys(saved?.approvals ?? {}).sort()).toEqual(['edit', 'ready', 'shoot']);
    expect(publishGatePassed(saved!)).toBe(true);
  });

  it('refuses a backup with a malformed approvals record', () => {
    const bad = {
      ...OLD_BACKUP,
      data: { ...OLD_BACKUP.data, ideas: [{ ...OLD_IDEA, approvals: { shoot: 'yesterday' } }] },
    };
    expect(parseBackup(JSON.stringify(bad)).ok).toBe(false);
  });
});
