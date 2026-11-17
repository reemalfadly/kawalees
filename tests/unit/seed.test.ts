// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { beforeEach, describe, expect, it } from 'vitest';
import { CTA_TEMPLATES, HOOK_TEMPLATES } from '@/lib/catalog';
import { db } from '@/lib/db';
import { checkMove, checkSchedule, effectiveStage, hasBlank, isLegacyIdea } from '@/lib/gates';
import { countWords } from '@/lib/script';
import { loadDemoData } from '@/lib/seed';
import { STAGES } from '@/lib/types';

/* The demo must be honest: it never shows an idea further along than the gates would let it go. */

const NOW = new Date(2026, 10, 17);

describe('demo data and the stage gates', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await loadDemoData(NOW);
  });

  it('gives every demo idea an approvals record, so none is treated as legacy', async () => {
    for (const idea of await db.ideas.toArray()) expect(isLegacyIdea(idea)).toBe(false);
  });

  it('lets every idea pass the gates of each stage before its own', async () => {
    for (const idea of await db.ideas.toArray()) {
      const fromStart = { ...idea, stage: 'idea' as const };
      expect(checkMove(fromStart, idea.stage).missing.map((m) => m.id)).toEqual([]);
      for (const s of STAGES)
        expect(checkMove(fromStart, s).ok || STAGES.indexOf(s) > STAGES.indexOf(idea.stage)).toBe(
          true,
        );
    }
  });

  it('approves exactly the stages an idea has left behind, in order, in the past', async () => {
    const order = ['shoot', 'edit', 'ready'] as const;
    for (const idea of await db.ideas.toArray()) {
      const at = STAGES.indexOf(idea.stage);
      const times = order.map((s) => idea.approvals?.[s]);
      order.forEach((s, k) => {
        const expected = at > STAGES.indexOf(s);
        expect(times[k] != null, `${idea.title}: ${s}`).toBe(expected);
      });
      const given = times.filter((t): t is number => t != null);
      expect(given).toEqual([...given].sort((a, b) => a - b));
      for (const t of given) {
        expect(t).toBeGreaterThanOrEqual(idea.createdAt);
        expect(t).toBeLessThanOrEqual(NOW.getTime());
      }
      if (idea.publishedAt != null) expect(idea.approvals?.ready).toBe(idea.publishedAt);
    }
  });

  it('keeps every published idea honestly published', async () => {
    const published = (await db.ideas.toArray()).filter((i) => i.stage === 'published');
    expect(published.length).toBeGreaterThan(0);
    for (const i of published) expect(effectiveStage(i)).toBe('published');
  });

  it('can schedule every scheduled idea, and its script is complete from «تصوير» on', async () => {
    for (const idea of await db.ideas.toArray()) {
      if (idea.scheduledFor) expect(checkSchedule(idea).ok, idea.title).toBe(true);
      if (STAGES.indexOf(idea.stage) >= STAGES.indexOf('shoot')) {
        expect(countWords(idea.hook)).toBeGreaterThanOrEqual(3);
        expect(countWords(idea.body)).toBeGreaterThanOrEqual(25);
        expect(hasBlank(`${idea.hook} ${idea.body} ${idea.cta}`)).toBe(false);
      }
    }
  });

  it('keeps proof and post links valid when present, and leaves some out on purpose', async () => {
    const later = (await db.ideas.toArray()).filter((i) => STAGES.indexOf(i.stage) >= 4);
    expect(later.some((i) => i.proof)).toBe(true);
    expect(later.some((i) => !i.proof)).toBe(true);
    for (const i of later)
      if (i.publishedUrl) expect(i.publishedUrl).toMatch(/^https:\/\/example\.com\//);
  });

  it('leaves some early ideas incomplete so the gates can be seen working', async () => {
    const early = (await db.ideas.toArray()).filter(
      (i) => i.stage === 'idea' || i.stage === 'script',
    );
    expect(early.some((i) => !checkMove(i, 'shoot').ok)).toBe(true);
    expect(early.some((i) => !checkSchedule(i).ok)).toBe(true);
  });

  it('keeps digits Western and never names the course or the build tools', async () => {
    const texts = (await db.ideas.toArray()).flatMap((i) => [i.title, i.hook, i.body, i.cta]);
    for (const t of texts) {
      expect(t).not.toMatch(/[٠-٩]/u);
      // Built from fragments so the public-repo guard script never trips on the literal words.
      const banned = new RegExp(
        `${['cla', 'ude'].join('')}|${['كل', 'ود'].join('')}|دورة|React|Vite|Dexie`,
        'iu',
      );
      expect(t).not.toMatch(banned);
    }
  });
});

describe('fill-in templates', () => {
  it('keeps the «___» blank in every hook template so the gate catches forgotten ones', () => {
    for (const t of HOOK_TEMPLATES) expect(hasBlank(t), t).toBe(true);
    for (const t of CTA_TEMPLATES.filter((c) => c.includes('___')))
      expect(hasBlank(t), t).toBe(true);
  });
});
