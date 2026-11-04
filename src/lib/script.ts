// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import type { Idea } from './types';

/* Script maths: word counts and how long a script takes to say out loud. */

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/u).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function scriptText(idea: Pick<Idea, 'hook' | 'body' | 'cta'>): string {
  return [idea.hook, idea.body, idea.cta].filter((s) => s.trim()).join('\n\n');
}

export function scriptWords(idea: Pick<Idea, 'hook' | 'body' | 'cta'>): number {
  return countWords(idea.hook) + countWords(idea.body) + countWords(idea.cta);
}

export function speakingSeconds(words: number, wordsPerMinute: number): number {
  if (words <= 0 || wordsPerMinute <= 0) return 0;
  return Math.round((words / wordsPerMinute) * 60);
}

/** "0:45", "1:30", "12:05" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** Target lengths per format, used to warn when a script runs long. */
export const FORMAT_TARGET_SECONDS: Partial<Record<Idea['format'], number>> = {
  reel: 90,
  short: 60,
  story: 60,
  live: 3600,
};
