// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { describe, expect, it } from 'vitest';
import { formatCompact, formatSigned, plural, WORDS } from '@/lib/format';
import { countWords, formatDuration, scriptText, scriptWords, speakingSeconds } from '@/lib/script';
import { normalizeArabic } from '@/lib/text';

describe('script maths', () => {
  it('counts Arabic and mixed words, ignoring punctuation-only tokens', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
    expect(countWords('سوّيت تطبيق كامل بدون برمجة')).toBe(5);
    expect(countWords('Final Cut يوفر ساعات — فعلاً!')).toBe(5);
    expect(countWords('سطر\n\nسطر ثاني')).toBe(3);
  });

  it('adds up the three script parts', () => {
    const parts = { hook: 'واحد اثنين', body: 'ثلاثة', cta: '' };
    expect(scriptWords(parts)).toBe(3);
    expect(scriptText(parts)).toBe('واحد اثنين\n\nثلاثة');
  });

  it('estimates speaking time', () => {
    expect(speakingSeconds(140, 140)).toBe(60);
    expect(speakingSeconds(70, 140)).toBe(30);
    expect(speakingSeconds(0, 140)).toBe(0);
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(75)).toBe('1:15');
    expect(formatDuration(605)).toBe('10:05');
  });
});

describe('number formatting', () => {
  it('uses Western digits and compacts big numbers', () => {
    expect(formatCompact(9_999)).toBe('9,999');
    expect(formatCompact(23_111)).toMatch(/^23\.1\s?ألف$/);
    expect(formatSigned(0)).toBe('0');
    expect(formatSigned(643)).toBe('+643');
    expect(formatSigned(-12)).toBe('−12');
  });

  it('follows Arabic plural rules', () => {
    expect(plural(1, WORDS.idea)).toBe('فكرة وحدة');
    expect(plural(2, WORDS.idea)).toBe('فكرتين');
    expect(plural(3, WORDS.idea)).toBe('3 أفكار');
    expect(plural(10, WORDS.idea)).toBe('10 أفكار');
    expect(plural(11, WORDS.idea)).toBe('11 فكرة');
    expect(plural(103, WORDS.idea)).toBe('103 أفكار');
    expect(plural(0, WORDS.day)).toBe('0 يوم');
  });
});

describe('Arabic search normalisation', () => {
  it('treats hamza, taa marbuta and alef maqsura variants as equal', () => {
    expect(normalizeArabic('أداة')).toBe(normalizeArabic('اداه'));
    expect(normalizeArabic('إلى')).toBe(normalizeArabic('الي'));
    expect(normalizeArabic('فِكرة')).toBe('فكره');
  });
});
