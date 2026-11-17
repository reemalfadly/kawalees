// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { describe, expect, it } from 'vitest';
import {
  approvalEntries,
  describeCreation,
  isCredibleSchedule,
  joinPhrases,
  requirementPhrase,
  scheduleBlockers,
  stageStatus,
} from '@/features/gate/stageStatus';
import { getRequirements } from '@/lib/gates';
import { buildIdea, type IdeaDraft } from '@/lib/repo';
import type { Idea } from '@/lib/types';

const WORDS_25 = Array.from({ length: 25 }, (_, i) => `كلمة${i}`).join(' ');
const words = (n: number) => Array.from({ length: n }, (_, i) => `ك${i}`).join(' ');

function gated(draft: Partial<IdeaDraft> = {}): Idea {
  return buildIdea({
    title: 'عنوان جيد',
    platforms: ['instagram'],
    ...draft,
    approvals: draft.approvals ?? {},
  });
}

describe('stageStatus: honest headline from real state', () => {
  it('says the hook is empty on a blank idea', () => {
    const s = stageStatus(gated());
    expect(s.next).toBe('script');
    expect(s.ready).toBe(true); // title, platform, format are enough to leave «فكرة»
  });

  it('reports hook and body counts when leaving the script stage', () => {
    const idea = gated({ stage: 'script', hook: '', body: words(8) });
    // buildIdea keeps the stage it is given: this is a pure view, not the repo.
    const s = stageStatus(idea);
    expect(s.next).toBe('shoot');
    expect(s.ready).toBe(false);
    expect(s.headline).toContain('الخطّاف فارغ');
    expect(s.headline).toContain('المحتوى 8 من 25 كلمة');
    expect(s.headline).not.toContain('جاهز تقريباً');
  });

  it('counts requirements met out of total', () => {
    const idea = gated({ stage: 'script', hook: 'ثلاث كلمات هنا', body: '' });
    const s = stageStatus(idea);
    expect(s.total).toBe(5);
    expect(s.met).toBe(4);
    expect(s.headline).toBe('قبل «تصوير»: المحتوى فارغ');
  });

  it('waits for the approval, not for a link, after the shoot', () => {
    const idea = gated({ stage: 'shoot', hook: 'ثلاث كلمات هنا', body: WORDS_25 });
    const s = stageStatus(idea);
    expect(s.headline).toBe('قبل «مونتاج»: بانتظار اعتمادك للتصوير');
    expect(s.total).toBe(1);
  });

  it('is ready once approved', () => {
    const idea = gated({ stage: 'shoot', approvals: { shoot: 1 } });
    const s = stageStatus(idea);
    expect(s.ready).toBe(true);
    expect(s.headline).toContain('استوفت الفكرة شروط الانتقال');
  });

  it('does not count an empty optional link, but flags a bad one', () => {
    const none = gated({ stage: 'edit', approvals: { edit: 1 } });
    expect(stageStatus(none).total).toBe(1);
    const bad = gated({ stage: 'ready', approvals: { ready: 1 }, publishedUrl: 'ftp:nope' });
    const s = stageStatus(bad);
    expect(s.ready).toBe(false);
    expect(s.headline).toContain('رابط المنشور غير صالح');
  });

  it('published has no next step', () => {
    const s = stageStatus(gated({ stage: 'published', approvals: { ready: 1 } }));
    expect(s.next).toBeNull();
    expect(s.headline).toBe('نزل للعالم');
  });
});

describe('requirementPhrase', () => {
  it('speaks about the blank mark and platform', () => {
    const idea = gated({ hook: 'مرحبا ___', platforms: [] });
    const reqs = getRequirements({ ...idea, stage: 'idea' }, 'script');
    const platform = reqs.find((r) => r.id === 'platform')!;
    expect(requirementPhrase(idea, platform)).toBe('لم تُحدَّد منصة');
    const blank = getRequirements({ ...idea, stage: 'script' }, 'shoot').find(
      (r) => r.id === 'blank-hook',
    )!;
    expect(requirementPhrase(idea, blank)).toContain('___');
  });

  it('joins with a count of the rest', () => {
    const idea = gated({ stage: 'script', hook: '', body: '', cta: 'ادعوا ___' });
    const unmet = getRequirements(idea, 'shoot').filter((r) => !r.met);
    expect(unmet.length).toBe(3);
    expect(joinPhrases(idea, unmet, 2)).toMatch(/وغيرها 1$/u);
  });
});

describe('schedule credibility', () => {
  it('needs hook and script for a new idea, but trusts legacy data', () => {
    const empty = gated({ scheduledFor: '2026-12-01' });
    expect(isCredibleSchedule(empty)).toBe(false);
    expect(scheduleBlockers(empty).map((r) => r.id)).toEqual(['hook', 'body']);
    const full = gated({ scheduledFor: '2026-12-01', hook: 'ثلاث كلمات هنا', body: WORDS_25 });
    expect(isCredibleSchedule(full)).toBe(true);
    const legacy = buildIdea({ title: 'x', scheduledFor: '2026-12-01' });
    expect(legacy.approvals).toBeUndefined();
    expect(isCredibleSchedule(legacy)).toBe(true);
    expect(isCredibleSchedule(gated())).toBe(false);
  });
});

describe('describeCreation', () => {
  it('is silent when the idea landed where asked', () => {
    expect(describeCreation({ stage: 'idea' }, gated())).toBeNull();
    expect(describeCreation({}, gated())).toBeNull();
  });

  it('explains a lowered stage', () => {
    const d = describeCreation({ stage: 'script' }, gated());
    expect(d?.title).toBe('حُفظت في «فكرة»');
    expect(d?.description).toContain('لم تُنقل إلى «كتابة» بعد');
  });

  it('explains a dropped day with what is missing', () => {
    const d = describeCreation({ scheduledFor: '2026-12-01' }, gated());
    expect(d?.description).toContain('لم يُحفظ الموعد');
    expect(d?.description).toContain('الخطّاف فارغ');
    expect(d?.description).toContain('المحتوى فارغ');
  });
});

describe('approvalEntries', () => {
  it('lists approvals in production order with their links', () => {
    const idea = gated({
      stage: 'published',
      approvals: { ready: 3, shoot: 1, edit: 2 },
      proof: 'cut.mp4',
      publishedUrl: 'https://instagram.com/reel/abc',
    });
    const e = approvalEntries(idea);
    expect(e.map((x) => x.stage)).toEqual(['shoot', 'edit', 'ready']);
    expect(e[0]?.link).toBeUndefined();
    expect(e[1]?.link).toEqual({ kind: 'proof', value: 'cut.mp4' });
    expect(e[2]?.link?.kind).toBe('url');
  });

  it('is empty for legacy ideas', () => {
    expect(approvalEntries(buildIdea({ title: 'x' }))).toEqual([]);
  });
});
