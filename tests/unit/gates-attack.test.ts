// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { beforeEach, describe, expect, it } from 'vitest';
import { exportBackup, parseBackup, restoreBackup } from '@/lib/backup';
import { db } from '@/lib/db';
import {
  checkSchedule,
  isRealDayKey,
  isRealTimeKey,
  isValidProof,
  isValidPublishedUrl,
  MAX_LINK_CHARS,
  publishGatePassed,
} from '@/lib/gates';
import {
  buildIdea,
  createIdea,
  deleteIdea,
  duplicateIdea,
  moveIdeaStage,
  restoreIdea,
  scheduleIdea,
  updateIdea,
  updateProof,
  type IdeaEdit,
} from '@/lib/repo';
import { countWords } from '@/lib/script';
import { countsAsPublished, ideaXp, publishedByWeek, totalXp } from '@/lib/stats';
import type { Idea, Stage } from '@/lib/types';

/* Attacks on the gates from every side except the normal screens: straight at the repo, with
   forged input, in parallel, and through copies, undo and backups. Each test says what it tried
   and what must still be true afterwards. */

const WORDS_25 = Array.from({ length: 25 }, (_, i) => `كلمة${i}`).join(' ');
const GOOD = {
  title: 'فكرة جيدة',
  platforms: ['instagram' as const],
  hook: 'هل جربت هذه الطريقة قبل اليوم',
  body: WORDS_25,
};
const URL_OK = 'https://instagram.com/reel/abc123';

const stored = async (id: string) => (await db.ideas.get(id))!;
const activityTotal = async () => (await db.activity.toArray()).reduce((n, r) => n + r.count, 0);

/** An idea carried honestly to «جاهز» through the real door. */
async function readyIdea(): Promise<Idea> {
  const idea = await createIdea({ ...GOOD, stage: 'shoot' });
  await moveIdeaStage(idea.id, 'ready', { approvals: ['shoot', 'edit'] });
  return stored(idea.id);
}

async function publishedIdea(): Promise<Idea> {
  const idea = await readyIdea();
  const r = await moveIdeaStage(idea.id, 'published', {
    approvals: ['ready'],
    publishedUrl: URL_OK,
  });
  expect(r.ok).toBe(true);
  return stored(idea.id);
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('attack: the protected fields cannot be written by a content edit', () => {
  it('ignores stage, approvals, proof, link, day and published time sent through updateIdea', async () => {
    const idea = await createIdea({ title: 'عنوان عادي', platforms: ['tiktok'] });
    const forged = {
      stage: 'published',
      approvals: { shoot: 1, edit: 2, ready: 3 },
      proof: 'forged.mp4',
      publishedUrl: URL_OK,
      scheduledFor: '2026-12-01',
      scheduledTime: '10:00',
      publishedAt: 1_700_000_000_000,
      id: 'another-id',
      createdAt: 5,
      hook: 'خطّاف حقيقي صالح تماماً',
    } as unknown as IdeaEdit;
    await updateIdea(idea.id, forged);
    const after = await stored(idea.id);
    expect(after.stage).toBe('idea');
    expect(after.approvals).toEqual({});
    expect(after.proof).toBeUndefined();
    expect(after.publishedUrl).toBeUndefined();
    expect(after.scheduledFor).toBeNull();
    expect(after.scheduledTime).toBeNull();
    expect(after.publishedAt).toBeNull();
    expect(after.createdAt).toBe(idea.createdAt);
    expect(await db.ideas.get('another-id')).toBeUndefined();
    // The permitted field of the same call did go through.
    expect(after.hook).toBe('خطّاف حقيقي صالح تماماً');
    expect(publishGatePassed({ ...after, approvals: after.approvals })).toBe(false);
  });

  it('a created idea cannot arrive with approvals, a link, a day or a stage it did not earn', async () => {
    const forged = {
      title: 'فكرة فاضية',
      platforms: ['instagram' as const],
      stage: 'published' as Stage,
      approvals: { shoot: 1, edit: 2, ready: 3 },
      proof: 'x.mp4',
      publishedUrl: URL_OK,
      scheduledFor: '2026-12-01',
      publishedAt: 1_700_000_000_000,
    };
    const idea = await createIdea(forged);
    const saved = await stored(idea.id);
    expect(saved).toMatchObject({ stage: 'script', scheduledFor: null, publishedAt: null });
    expect(saved.approvals).toEqual({});
    expect(saved.proof).toBeUndefined();
    expect(saved.publishedUrl).toBeUndefined();
    // Even with a perfect script, a new idea never gets past «تصوير» without its approvals.
    const full = await createIdea({
      ...GOOD,
      stage: 'published',
      approvals: { shoot: 1, edit: 1, ready: 1 },
    });
    expect(full.stage).toBe('shoot');
    expect((await stored(full.id)).approvals).toEqual({});
  });
});

describe('attack: forged input to the one door between stages', () => {
  it('refuses a stage that does not exist instead of writing it («backward is free»)', async () => {
    const idea = await createIdea(GOOD);
    for (const bogus of ['hacked', '', 'PUBLISHED', undefined, null, 5] as unknown as Stage[]) {
      const r = await moveIdeaStage(idea.id, bogus);
      expect(r.ok).toBe(false);
      expect((await stored(idea.id)).stage).toBe('idea');
    }
  });

  it('ignores approvals for stages that are not being crossed, or that are not approval stages', async () => {
    const idea = await createIdea({ ...GOOD });
    // From «فكرة» to «كتابة»: nothing but the first gate; pre-approving later stages must not stick.
    const r = await moveIdeaStage(idea.id, 'script', {
      approvals: ['shoot', 'edit', 'ready', 'published', 'idea', 'nonsense' as Stage],
    });
    expect(r.ok).toBe(true);
    const after = await stored(idea.id);
    expect(after.approvals?.shoot).toBeUndefined();
    expect(after.approvals?.edit).toBeUndefined();
    expect(after.approvals?.ready).toBeUndefined();
    // Nothing at all was recorded: «فكرة» and «كتابة» are not stages that take a confirmation.
    expect(Object.keys(after.approvals ?? {})).toEqual([]);
    // So the shoot gate still has to be passed for real.
    const next = await moveIdeaStage(idea.id, 'shoot');
    expect(next.ok).toBe(true);
    const refused = await moveIdeaStage(idea.id, 'edit');
    expect(refused.ok).toBe(false);
    expect(refused.missing.map((m) => m.id)).toEqual(['approve-shoot']);
  });

  it('cannot approve the shoot while only leaving «فكرة» and then skip it', async () => {
    const idea = await createIdea(GOOD);
    await moveIdeaStage(idea.id, 'script', { approvals: ['shoot'] });
    const jump = await moveIdeaStage(idea.id, 'edit');
    expect(jump.ok).toBe(false);
    expect(jump.missing.map((m) => m.id)).toContain('approve-shoot');
    expect((await stored(idea.id)).stage).toBe('script');
  });

  it('a jump over several stages needs every gate on the way, in one call', async () => {
    const empty = await createIdea({ title: 'فكرة فاضية', platforms: ['instagram'] });
    const r = await moveIdeaStage(empty.id, 'published', {
      approvals: ['shoot', 'edit', 'ready'],
      proof: 'abc',
      publishedUrl: URL_OK,
    });
    expect(r.ok).toBe(false);
    expect(r.missing.map((m) => m.id)).toEqual(['hook', 'body']);
    expect((await stored(empty.id)).stage).toBe('idea');
    expect(await activityTotal()).toBe(1); // only the creation
  });

  it('a refused move writes nothing at all: no approvals, no link, no stage, no activity', async () => {
    const idea = await createIdea({ ...GOOD, stage: 'shoot' });
    const before = JSON.stringify(await stored(idea.id));
    const activity = await activityTotal();
    const r = await moveIdeaStage(idea.id, 'published', {
      approvals: ['shoot', 'edit'], // «ready» missing
      proof: 'cut.mp4',
      publishedUrl: URL_OK,
    });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(await stored(idea.id))).toBe(before);
    expect(await activityTotal()).toBe(activity);
  });

  it('a link longer than a backup can hold is refused, so every idea stays exportable', async () => {
    const idea = await readyIdea();
    const huge = `https://instagram.com/${'a'.repeat(MAX_LINK_CHARS)}`;
    expect(isValidPublishedUrl(huge)).toBe(false);
    const r = await moveIdeaStage(idea.id, 'published', {
      approvals: ['ready'],
      publishedUrl: huge,
    });
    expect(r.ok).toBe(false);
    expect(r.missing[0]?.label).toContain('أطول');
    const longProof = 'p'.repeat(MAX_LINK_CHARS + 1);
    expect(isValidProof(longProof)).toBe(false);
    const edit = await createIdea({ ...GOOD, stage: 'shoot' });
    await moveIdeaStage(edit.id, 'edit', { approvals: ['shoot'] });
    const r2 = await moveIdeaStage(edit.id, 'ready', { approvals: ['edit'], proof: longProof });
    expect(r2.ok).toBe(false);
    expect(r2.missing[0]?.label).toContain('أطول');
    const fix = await updateProof(idea.id, { publishedUrl: huge });
    expect(fix.ok).toBe(false);
    // The longest allowed link round-trips through a backup.
    const maxUrl = `https://instagram.com/${'a'.repeat(MAX_LINK_CHARS - 'https://instagram.com/'.length)}`;
    expect(isValidPublishedUrl(maxUrl)).toBe(true);
    const ok = await moveIdeaStage(idea.id, 'published', {
      approvals: ['ready'],
      publishedUrl: maxUrl,
    });
    expect(ok.ok).toBe(true);
    const parsed = parseBackup(JSON.stringify(await exportBackup()));
    expect(parsed.ok).toBe(true);
  });
});

describe('attack: parallel calls and double presses', () => {
  it('the same move twice at once moves once and counts once', async () => {
    const idea = await createIdea({ ...GOOD, stage: 'shoot' });
    const activity = await activityTotal();
    const [a, b] = await Promise.all([
      moveIdeaStage(idea.id, 'edit', { approvals: ['shoot'] }),
      moveIdeaStage(idea.id, 'edit', { approvals: ['shoot'] }),
    ]);
    expect(a.ok && b.ok).toBe(true);
    expect((await stored(idea.id)).stage).toBe('edit');
    expect(await activityTotal()).toBe(activity + 1);
    expect(Object.keys((await stored(idea.id)).approvals ?? {})).toEqual(['shoot']);
  });

  it('two different moves at once end in a state the gates allow', async () => {
    const idea = await createIdea({ ...GOOD, stage: 'shoot' });
    const results = await Promise.all([
      moveIdeaStage(idea.id, 'edit', { approvals: ['shoot'] }),
      moveIdeaStage(idea.id, 'published', { approvals: ['ready'], publishedUrl: URL_OK }),
      moveIdeaStage(idea.id, 'script'),
    ]);
    const after = await stored(idea.id);
    // Whatever order they ran in, «منشور» can never have been reached without every approval.
    if (after.stage === 'published') {
      expect(after.approvals?.shoot).toBeTypeOf('number');
      expect(after.approvals?.edit).toBeTypeOf('number');
      expect(after.approvals?.ready).toBeTypeOf('number');
    }
    expect(results.filter((r) => !r.ok).every((r) => r.missing.length > 0)).toBe(true);
    expect(results[1]!.ok).toBe(false);
  });

  it('typing while moving never loses approvals, and moving never loses the typing', async () => {
    const idea = await createIdea({ ...GOOD, stage: 'shoot' });
    await Promise.all([
      updateIdea(idea.id, { notes: 'ملاحظة جديدة', hook: 'خطّاف معدّل أثناء النقل' }),
      moveIdeaStage(idea.id, 'edit', { approvals: ['shoot'] }),
      updateIdea(idea.id, { cta: 'احفظوا المنشور' }),
    ]);
    const after = await stored(idea.id);
    expect(after.stage).toBe('edit');
    expect(after.approvals?.shoot).toBeTypeOf('number');
    expect(after).toMatchObject({
      notes: 'ملاحظة جديدة',
      hook: 'خطّاف معدّل أثناء النقل',
      cta: 'احفظوا المنشور',
    });
  });

  it('a day cannot be put on an idea while its script is being emptied at the same moment', async () => {
    const idea = await createIdea(GOOD);
    await Promise.all([
      updateIdea(idea.id, { hook: '', body: '' }),
      scheduleIdea(idea.id, '2026-12-01'),
    ]);
    const after = await stored(idea.id);
    // Either order is a real order: if the day got in, the script was complete at that moment;
    // if the script was emptied first the day was refused. It must never be both empty and dated
    // for a day set after the emptying.
    if (after.scheduledFor) expect(after.hook === '' && after.body === '').toBe(true);
    const later = await scheduleIdea(idea.id, '2026-12-02');
    expect(later.ok).toBe(false);
  });
});

describe('attack: going back and forward again', () => {
  it('going back reopens the content gates for the next forward move', async () => {
    const idea = await createIdea({ ...GOOD, stage: 'shoot' });
    await moveIdeaStage(idea.id, 'edit', { approvals: ['shoot'] });
    await moveIdeaStage(idea.id, 'idea');
    await updateIdea(idea.id, { hook: '', body: '' });
    const r = await moveIdeaStage(idea.id, 'edit');
    expect(r.ok).toBe(false);
    expect(r.missing.map((m) => m.id)).toEqual(['hook', 'body']);
    expect((await stored(idea.id)).stage).toBe('idea');
  });

  it('DESIGN: undo of a forward move keeps its approval, so going forward again needs no second box', async () => {
    const idea = await createIdea({ ...GOOD, stage: 'shoot' });
    const first = await moveIdeaStage(idea.id, 'edit', { approvals: ['shoot'] }, 1_700_000_000_000);
    expect(first.ok).toBe(true);
    await moveIdeaStage(idea.id, 'shoot'); // «تراجع»
    expect((await stored(idea.id)).approvals).toEqual({ shoot: 1_700_000_000_000 });
    const again = await moveIdeaStage(idea.id, 'edit', {}, 1_800_000_000_000);
    expect(again.ok).toBe(true);
    // The original time is kept: the second pass does not restamp it.
    expect((await stored(idea.id)).approvals).toEqual({ shoot: 1_700_000_000_000 });
  });

  it('moving back from «منشور» clears the published time, so the numbers drop at once', async () => {
    const idea = await publishedIdea();
    expect(countsAsPublished(idea)).toBe(true);
    await moveIdeaStage(idea.id, 'ready');
    const back = await stored(idea.id);
    expect(back.publishedAt).toBeNull();
    expect(countsAsPublished(back)).toBe(false);
    expect(ideaXp(back)).toBeLessThan(ideaXp(idea));
    // And forward again stamps a fresh time rather than reviving an old one.
    const again = await moveIdeaStage(idea.id, 'published', {}, 1_900_000_000_000);
    expect(again.ok).toBe(true);
    expect((await stored(idea.id)).publishedAt).toBe(1_900_000_000_000);
  });

  it('DESIGN: a script emptied after its gate does not stop later moves (only the stage being left is judged)', async () => {
    const idea = await createIdea({ ...GOOD, stage: 'shoot' });
    await updateIdea(idea.id, { hook: '', body: '' });
    const r = await moveIdeaStage(idea.id, 'edit', { approvals: ['shoot'] });
    expect(r.ok).toBe(true);
    // Scheduling, which judges the script itself, is still refused for that idea.
    expect((await scheduleIdea(idea.id, '2026-12-01')).ok).toBe(false);
  });
});

describe('attack: copies, deletion and restore', () => {
  it('a copy of a published idea starts gated: no approvals, no link, not published, no points of its own for publishing', async () => {
    const original = await publishedIdea();
    const copy = (await duplicateIdea(original.id))!;
    expect(copy.id).not.toBe(original.id);
    expect(copy.stage).toBe('shoot'); // content is complete, but nothing else is earned
    expect(copy.approvals).toEqual({});
    expect(copy.proof).toBeUndefined();
    expect(copy.publishedUrl).toBeUndefined();
    expect(copy.publishedAt).toBeNull();
    expect(copy.scheduledFor).toBeNull();
    expect(countsAsPublished(copy)).toBe(false);
    const both = await db.ideas.toArray();
    expect(both.filter(countsAsPublished)).toHaveLength(1);
    expect(totalXp(both, [])).toBeLessThan(2 * ideaXp(original));
    // The copy cannot be published without going through the gates again.
    const r = await moveIdeaStage(copy.id, 'published', {
      approvals: ['ready'],
      publishedUrl: URL_OK,
    });
    expect(r.ok).toBe(false);
    expect(r.missing.map((m) => m.id)).toEqual(['approve-shoot', 'approve-edit']);
  });

  it('copying a scheduled idea does not copy its day; copying again and again keeps the title valid', async () => {
    const idea = await createIdea(GOOD);
    await scheduleIdea(idea.id, '2026-12-01', '10:00');
    let copy = (await duplicateIdea(idea.id))!;
    expect(copy.scheduledFor).toBeNull();
    const longTitle = 'ع'.repeat(299);
    const long = await createIdea({ ...GOOD, title: longTitle });
    copy = (await duplicateIdea(long.id))!;
    expect(copy.title.length).toBeLessThanOrEqual(300);
    expect(copy.title.endsWith('(نسخة)')).toBe(true);
    for (let i = 0; i < 3; i++) copy = (await duplicateIdea(copy.id))!;
    expect(copy.title.length).toBeLessThanOrEqual(300);
    expect(parseBackup(JSON.stringify(await exportBackup())).ok).toBe(true);
  });

  it('delete then restore brings the idea back exactly as it was, approvals included', async () => {
    const idea = await publishedIdea();
    const removed = (await deleteIdea(idea.id))!;
    expect(await db.ideas.get(idea.id)).toBeUndefined();
    await restoreIdea(removed);
    expect(await stored(idea.id)).toEqual(idea);
  });

  it('operations on an idea that no longer exists fail cleanly and write nothing', async () => {
    const idea = await createIdea(GOOD);
    await deleteIdea(idea.id);
    const activity = await activityTotal();
    expect(await moveIdeaStage(idea.id, 'script')).toMatchObject({ ok: false, error: 'not-found' });
    expect(await scheduleIdea(idea.id, '2026-12-01')).toMatchObject({
      ok: false,
      error: 'not-found',
    });
    expect(await updateProof(idea.id, { proof: 'abc.mp4' })).toMatchObject({
      ok: false,
      error: 'not-found',
    });
    await updateIdea(idea.id, { hook: 'لن يُكتب في أي مكان' });
    expect(await db.ideas.count()).toBe(0);
    expect(await activityTotal()).toBe(activity);
  });
});

describe('attack: the calendar door', () => {
  it('refuses days and times that do not exist, and stores nothing', async () => {
    const idea = await createIdea(GOOD);
    for (const day of [
      '2026-02-30',
      '2026-13-01',
      '2026-00-10',
      '2026-04-31',
      '0000-01-01',
      '9999-99-99',
      '2026-1-1',
      ' 2026-12-01',
      '2026-12-01 ',
      '٢٠٢٦-١٢-٠١',
    ]) {
      const r = await scheduleIdea(idea.id, day);
      expect(r.ok, `day «${day}»`).toBe(false);
      expect(r.missing.map((m) => m.id)).toEqual(['schedule-date']);
    }
    for (const time of ['24:00', '99:99', '12:60', '1:30', '12:5', '12:30:00', '١٢:٣٠']) {
      const r = await scheduleIdea(idea.id, '2026-12-01', time);
      expect(r.ok, `time «${time}»`).toBe(false);
      expect(r.missing.map((m) => m.id)).toEqual(['schedule-time']);
    }
    expect((await stored(idea.id)).scheduledFor).toBeNull();
    expect(await activityTotal()).toBe(1);
  });

  it('accepts the edges of the calendar: leap day, the last minute of the day', async () => {
    const idea = await createIdea(GOOD);
    expect(isRealDayKey('2028-02-29')).toBe(true);
    expect(isRealDayKey('2027-02-29')).toBe(false);
    expect(isRealDayKey('2026-12-31')).toBe(true);
    expect(isRealTimeKey('00:00')).toBe(true);
    expect(isRealTimeKey('23:59')).toBe(true);
    expect((await scheduleIdea(idea.id, '2028-02-29', '23:59')).ok).toBe(true);
    expect((await stored(idea.id)).scheduledFor).toBe('2028-02-29');
  });

  it('a day on one idea does not open a day for another, and clearing is always allowed', async () => {
    const a = await createIdea(GOOD);
    const b = await createIdea({ title: 'فكرة ب', platforms: ['tiktok'] });
    expect((await scheduleIdea(a.id, '2026-12-01')).ok).toBe(true);
    expect((await scheduleIdea(b.id, '2026-12-01')).ok).toBe(false);
    await updateIdea(a.id, { hook: '', body: '' });
    // Emptied script: the old day can be removed, and only that.
    expect((await scheduleIdea(a.id, null)).ok).toBe(true);
    expect((await scheduleIdea(a.id, '2026-12-05')).ok).toBe(false);
    expect((await stored(a.id)).scheduledFor).toBeNull();
  });

  it('a same-day change of time is the one edit allowed without the script gate', async () => {
    const a = await createIdea(GOOD);
    await scheduleIdea(a.id, '2026-12-01', '10:00');
    await updateIdea(a.id, { hook: '', body: '' });
    expect(checkSchedule(await stored(a.id)).ok).toBe(false);
    const t = await scheduleIdea(a.id, '2026-12-01', '11:30');
    expect(t.ok).toBe(true);
    expect((await stored(a.id)).scheduledTime).toBe('11:30');
    // A different day is a new schedule and is refused.
    expect((await scheduleIdea(a.id, '2026-12-02', '11:30')).ok).toBe(false);
  });

  it('publishing time lands on the local day it happened, around midnight and month ends', async () => {
    const idea = await readyIdea();
    // 23:59 local on the last day of a month, then 00:01 on the first of the next.
    const lastMinute = new Date(2026, 9, 31, 23, 59).getTime();
    const firstMinute = new Date(2026, 10, 1, 0, 1).getTime();
    await moveIdeaStage(idea.id, 'published', { approvals: ['ready'] }, lastMinute);
    const a = await stored(idea.id);
    expect(a.publishedAt).toBe(lastMinute);
    const weeks = publishedByWeek([a], 6, 6, new Date(2026, 10, 2));
    expect(weeks.reduce((n, w) => n + w.count, 0)).toBe(1);
    await moveIdeaStage(idea.id, 'ready');
    await moveIdeaStage(idea.id, 'published', {}, firstMinute);
    expect((await stored(idea.id)).publishedAt).toBe(firstMinute);
  });
});

describe('attack: what counts as a word', () => {
  it('counts Arabic-Indic digits as words (a script of numbers is still a script of 25 words)', () => {
    const digits = Array.from({ length: 25 }, (_, i) =>
      String.fromCharCode(0x0660 + (i % 10)),
    ).join(' ');
    expect(countWords(digits)).toBe(25);
    expect(countWords('٣ نصائح للمبتدئين')).toBe(3);
    expect(countWords('3 نصائح للمبتدئين')).toBe(3);
  });

  it('does not count punctuation, dashes, ellipses, the blank mark or emoji on their own', () => {
    expect(countWords('- — … ؟ ! ، ؛ ___ ____ 😀 ✨')).toBe(0);
    expect(countWords('  \n\t  ')).toBe(0);
    expect(countWords('كلمة—كلمة')).toBe(1);
  });

  it('treats any whitespace the same, including non-breaking and ideographic spaces', () => {
    expect(countWords('أ ب　ج د​هـ')).toBeGreaterThanOrEqual(4);
  });
});

describe('attack: backups', () => {
  it('a backup written by this version round-trips with every gate field intact', async () => {
    const idea = await publishedIdea();
    const backup = await exportBackup();
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.ok).toBe(true);
    await db.ideas.clear();
    if (parsed.ok) await restoreBackup(parsed.backup);
    expect(await stored(idea.id)).toEqual(idea);
  });

  it('a backup with gate fields of the wrong type is refused whole, not half-imported', async () => {
    const idea = await publishedIdea();
    const backup = JSON.parse(JSON.stringify(await exportBackup()));
    backup.data.ideas[0].approvals = { ready: 'yesterday' };
    expect(parseBackup(JSON.stringify(backup)).ok).toBe(false);
    backup.data.ideas[0].approvals = { published: 5, hack: 1 };
    expect(parseBackup(JSON.stringify(backup)).ok).toBe(false);
    expect(await db.ideas.count()).toBe(1);
    expect((await stored(idea.id)).stage).toBe('published');
  });

  it('a backup from before gates (no approvals anywhere) imports as is and is never judged', async () => {
    const old = buildIdea({ title: 'قديمة', stage: 'published' }); // no approvals key at all
    expect('approvals' in old).toBe(false);
    const parsed = parseBackup(
      JSON.stringify({
        app: 'kawalees',
        schema: 1,
        exportedAt: new Date().toISOString(),
        data: { ideas: [old], pillars: [], stats: [], activity: [], settings: null },
      }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) await restoreBackup(parsed.backup);
    const back = await stored(old.id);
    expect('approvals' in back).toBe(false);
    expect(publishGatePassed(back)).toBe(true);
    expect(countsAsPublished(back)).toBe(true);
  });
});
