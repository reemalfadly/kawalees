// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { normalizeArabic } from './text';

/* Voice-follow for the teleprompter: works out how far into the script the
   reader has got from what the speech recogniser heard. Pure, so it's tested
   without a microphone. */

/** Words and the spaces between them, keeping every character so the script renders as written. */
export function tokenize(text: string): string[] {
  return text.split(/(\s+)/u).filter(Boolean);
}

export const isSpace = (token: string) => /^\s+$/u.test(token);

/** Comparable form of a word: Arabic-normalised, lower case, no punctuation or diacritics. */
export function normalizeWord(word: string): string {
  return normalizeArabic(word).replace(/[^\p{L}\p{N}]/gu, '');
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Close enough to count as the same spoken word: exact, a clitic away (و، ف، ب، ال…), or one letter off. */
export function sameWord(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= 3 && long.length - short.length <= 3) {
    if (long.endsWith(short) || long.startsWith(short)) return true;
  }
  return short.length >= 4 && editDistanceAtMostOne(a, b);
}

/**
 * Where the reader is now: the index just past the last script word the speech lines up with.
 * Looks a little behind and a stretch ahead of `pos`, needs two words in a row to jump, and
 * never moves backwards, so a misheard word can't throw the script around.
 */
export function followSpeech(
  script: readonly string[],
  pos: number,
  heard: readonly string[],
  lookahead = 40,
): number {
  const said = heard.map(normalizeWord).filter(Boolean).slice(-5);
  const last = said[said.length - 1];
  if (!last) return pos;

  let best = -1;
  let bestScore = 0;
  const from = Math.max(0, pos - 3);
  const to = Math.min(script.length - 1, pos + lookahead);
  for (let j = from; j <= to; j++) {
    if (!sameWord(script[j] ?? '', last)) continue;
    // Count the earlier spoken words that line up just before j, allowing a skipped word.
    let score = 1;
    let k = j - 1;
    for (let s = said.length - 2; s >= 0 && k >= Math.max(0, j - 8); s--) {
      const word = said[s] ?? '';
      if (sameWord(script[k] ?? '', word)) {
        score++;
        k--;
      } else if (k >= 1 && sameWord(script[k - 1] ?? '', word)) {
        score++;
        k -= 2;
      }
    }
    // A single word only moves us when it is the very next thing to say.
    const nearby = j - pos <= 2 && last.length >= 2;
    if (score < 2 && !nearby) continue;
    if (score > bestScore || (score === bestScore && Math.abs(j - pos) < Math.abs(best - pos))) {
      best = j;
      bestScore = score;
    }
  }
  return best < 0 ? pos : Math.max(pos, best + 1);
}
