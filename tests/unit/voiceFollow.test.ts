// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { describe, expect, it } from 'vitest';
import { followSpeech, normalizeWord, sameWord, tokenize } from '@/lib/voiceFollow';

const script = 'صوّرت سبع فيديوهات في يوم واحد وهذي الطريقة بالضبط البداية كانت قائمة أفكار جاهزة'
  .split(' ')
  .map(normalizeWord);

describe('voice-follow', () => {
  it('keeps every character when tokenising', () => {
    const text = 'أهلاً،  فيكم\nيلا نبدأ';
    expect(tokenize(text).join('')).toBe(text);
  });

  it('matches spoken forms of the same word', () => {
    expect(sameWord(normalizeWord('صوّرت'), normalizeWord('صورت'))).toBe(true);
    expect(sameWord(normalizeWord('الطريقة'), normalizeWord('الطريقه'))).toBe(true);
    expect(sameWord(normalizeWord('وهذي'), normalizeWord('هذي'))).toBe(true);
    expect(sameWord(normalizeWord('فيديوهات'), normalizeWord('فديوهات'))).toBe(true);
    expect(sameWord('يوم', 'قائمه')).toBe(false);
  });

  it('follows the reader word by word', () => {
    let pos = followSpeech(script, 0, ['صورت']);
    expect(pos).toBe(1);
    pos = followSpeech(script, pos, ['صورت', 'سبع', 'فيديوهات']);
    expect(pos).toBe(3);
  });

  it('catches up when the recogniser lags, but needs two words to jump', () => {
    expect(followSpeech(script, 0, ['الطريقة', 'بالضبط'])).toBe(9);
    // One common word far ahead is not enough to jump there.
    expect(followSpeech(script, 0, ['البداية'])).toBe(0);
  });

  it('never moves backwards and ignores noise', () => {
    expect(followSpeech(script, 9, ['صورت', 'سبع'])).toBe(9);
    expect(followSpeech(script, 3, ['امم', 'اه'])).toBe(3);
    expect(followSpeech(script, 3, [])).toBe(3);
  });
});
