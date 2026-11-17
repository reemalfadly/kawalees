// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { describe, expect, it } from 'vitest';
import { CTA_TEMPLATES, HOOK_TEMPLATES, SPARK_PROMPTS } from '@/lib/catalog';
import { db } from '@/lib/db';
import { GLYPH_KEYS } from '@/features/stats/glyphMap';
import { loadDemoData } from '@/lib/seed';
import { ACHIEVEMENT_ICON_KEYS, LEVELS, achievements } from '@/lib/stats';

/* Copy that the app puts in people's mouths must not change with the speaker's gender:
   no second-person commands (اكتب / اكتبي) and no "tell me / give me" forms. The plural
   «اكتبوا» is the one accepted command form. */

const ARABIC_LETTER = '\u0600-\u06FF';
const FORBIDDEN = [
  'اكتب',
  'اكتبي',
  'شارك',
  'شاركي',
  'شاركني',
  'شاركه',
  'شاركها',
  'احفظ',
  'احفظي',
  'تابع',
  'تابعي',
  'علّق',
  'علق',
  'علقي',
  'قول',
  'قولي',
  'قل',
  'جرب',
  'جربي',
  'خذ',
  'خذي',
  'عطني',
  'ودك',
  'عندك',
  'تبي',
  'تبين',
];
const FORBIDDEN_RE = new RegExp(
  `(?<![${ARABIC_LETTER}])(?:${FORBIDDEN.join('|')})(?![${ARABIC_LETTER}])`,
);

function offenders(lines: string[]): string[] {
  return lines.filter((l) => FORBIDDEN_RE.test(l));
}

describe('gender-neutral templates', () => {
  it('keeps hook templates free of gendered commands', () => {
    expect(offenders(HOOK_TEMPLATES)).toEqual([]);
  });

  it('keeps call-to-action templates free of gendered commands', () => {
    expect(offenders(CTA_TEMPLATES)).toEqual([]);
  });

  it('keeps the spark prompts free of gendered commands', () => {
    expect(offenders(SPARK_PROMPTS)).toEqual([]);
  });

  it('offers the comment-word invitation in the neutral form', () => {
    expect(CTA_TEMPLATES.some((t) => t.includes('بالتعليق بكلمة «___»'))).toBe(true);
    expect(CTA_TEMPLATES.some((t) => t.startsWith('اكتب'))).toBe(false);
  });

  it('keeps every template fill-in marker intact', () => {
    for (const t of [...HOOK_TEMPLATES, ...CTA_TEMPLATES.filter((c) => c.includes('___'))])
      expect(t).toContain('___');
  });

  it('keeps the demo content free of gendered commands too', async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await loadDemoData(new Date(2026, 10, 17));
    const ideas = await db.ideas.toArray();
    const texts = ideas.flatMap((i) => [i.title, i.hook, i.body, i.cta]).filter(Boolean);
    expect(texts.length).toBeGreaterThan(0);
    expect(offenders(texts)).toEqual([]);
  });

  it('catches the forms it is meant to forbid', () => {
    expect(offenders(['اكتب «جدول» بالتعليقات', 'اكتبي لنا', 'شاركني رأيك'])).toHaveLength(3);
    expect(offenders(['اكتبوا «جدول» بالتعليقات', 'بالتعليق بكلمة «جدول»'])).toEqual([]);
  });
});

describe('line icons for levels and achievements', () => {
  it('gives every level an icon the icon set can draw', () => {
    for (const l of LEVELS) expect(GLYPH_KEYS).toContain(l.icon);
  });

  it('gives every achievement an icon key from the known set', () => {
    const list = achievements({
      ideas: [],
      stats: [],
      activeDays: [],
      weeklyGoal: 3,
      weekStartsOn: 0,
    });
    expect(list.length).toBeGreaterThan(0);
    for (const a of list) {
      expect(ACHIEVEMENT_ICON_KEYS).toContain(a.icon);
      expect(GLYPH_KEYS).toContain(a.icon);
    }
  });
});
