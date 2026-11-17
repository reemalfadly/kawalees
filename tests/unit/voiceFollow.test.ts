// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { describe, expect, it } from 'vitest';
import {
  countBlanks,
  DEFAULT_DIALECT,
  describeVoiceError,
  detectDevice,
  DIALECTS,
  followSpeech,
  isIosStandalone,
  normalizeWord,
  parseDialect,
  resyncPosition,
  sameWord,
  tokenize,
} from '@/lib/voiceFollow';

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

describe('touching a word to resync', () => {
  it('counts the touched word as said, so the tracker carries on after it', () => {
    expect(resyncPosition(0, 10)).toBe(1);
    expect(resyncPosition(4, 10)).toBe(5);
    expect(resyncPosition(9, 10)).toBe(10);
  });

  it('stays inside the script', () => {
    expect(resyncPosition(50, 10)).toBe(10);
    expect(resyncPosition(-3, 10)).toBe(1);
    expect(resyncPosition(Number.NaN, 10)).toBe(0);
    expect(resyncPosition(2, 0)).toBe(0);
  });

  it('lets the reader jump back and then be followed from there', () => {
    const pos = resyncPosition(1, script.length);
    expect(pos).toBe(2);
    expect(followSpeech(script, pos, ['فيديوهات'])).toBe(3);
  });
});

describe('template blanks', () => {
  it('counts every unfilled placeholder across the script', () => {
    expect(countBlanks('أغلبنا يسوي ___ غلط', 'نص بلا فراغ', 'قولي: ___ ولا ___؟')).toBe(3);
    expect(countBlanks('', '', '')).toBe(0);
    expect(countBlanks('خطّ _ قصير و__ أقصر')).toBe(0);
  });
});

describe('dialects', () => {
  it('offers the five dialects, Saudi first', () => {
    expect(DIALECTS.map((d) => d.code)).toEqual(['ar-SA', 'ar-KW', 'ar-AE', 'ar-EG', 'ar-JO']);
    expect(DEFAULT_DIALECT).toBe('ar-SA');
  });

  it('falls back to the default for anything unknown', () => {
    expect(parseDialect('ar-KW')).toBe('ar-KW');
    expect(parseDialect('fr-FR')).toBe('ar-SA');
    expect(parseDialect(null)).toBe('ar-SA');
  });
});

describe('recognition problems', () => {
  it('explains a refused microphone and falls back to the steady speed', () => {
    const issue = describeVoiceError('not-allowed');
    expect(issue.kind).toBe('permission');
    expect(issue.fatal).toBe(true);
    expect(describeVoiceError('service-not-allowed').kind).toBe('service');
  });

  it('says plainly that voice mode needs the internet', () => {
    const issue = describeVoiceError('network');
    expect(issue.fatal).toBe(true);
    expect(issue.text).toContain('إنترنت');
  });

  it('keeps listening through silence and unsupported dialects, which are handled by the screen', () => {
    expect(describeVoiceError('no-speech')).toMatchObject({ kind: 'silence', fatal: false });
    expect(describeVoiceError('language-not-supported')).toMatchObject({
      kind: 'language',
      fatal: false,
    });
    expect(describeVoiceError('aborted').kind).toBe('ignore');
  });

  it('never leaves an unknown error without a message', () => {
    const issue = describeVoiceError('something-new');
    expect(issue.kind).toBe('unknown');
    expect(issue.title).not.toBe('');
  });
});

describe('device checks', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
  const ipadAsMac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15';

  it('tells iPhone, iPad, Android and computers apart', () => {
    expect(detectDevice({ ua: iphone })).toBe('ios');
    expect(detectDevice({ ua: ipadAsMac, maxTouchPoints: 5 })).toBe('ios');
    expect(detectDevice({ ua: ipadAsMac, maxTouchPoints: 0 })).toBe('desktop');
    expect(detectDevice({ ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)' })).toBe('android');
  });

  it('flags only the installed app on iOS, never the browser', () => {
    expect(isIosStandalone({ ua: iphone, standalone: true })).toBe(true);
    expect(isIosStandalone({ ua: iphone, displayStandalone: true })).toBe(true);
    expect(isIosStandalone({ ua: iphone, standalone: false, displayStandalone: false })).toBe(
      false,
    );
    expect(
      isIosStandalone({ ua: 'Mozilla/5.0 (Linux; Android 14)', displayStandalone: true }),
    ).toBe(false);
  });
});
