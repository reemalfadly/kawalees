// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710

/* Reading comfort on the filming screen: five text sizes and three line heights, each kept
   under its own key. Pure (the storage is passed in), so it is unit-tested. */

export const SIZE_KEY = 'kawalees:prompter-size-level';
export const LEADING_KEY = 'kawalees:prompter-leading-level';

/** Text sizes in px, from small to very large. The middle one is the old default (40). */
export const SIZE_LEVELS = [32, 40, 50, 62, 76] as const;
export const DEFAULT_SIZE_LEVEL = 1;

/** Line heights: tight, normal, airy. */
export const LEADING_LEVELS = [
  { value: 1.4, label: 'مضغوط' },
  { value: 1.58, label: 'متوسط' },
  { value: 1.85, label: 'مريح' },
] as const;
export const DEFAULT_LEADING_LEVEL = 1;

/** A stored or typed value as a valid level index, or the fallback. */
export function clampLevel(value: unknown, count: number, fallback: number): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n >= count) return fallback;
  return n;
}

/** The level whose size is closest to an old free-form size (the version before levels). */
export function levelFromLegacySize(px: unknown): number | null {
  if (typeof px !== 'number' || !Number.isFinite(px)) return null;
  let best = 0;
  SIZE_LEVELS.forEach((size, i) => {
    if (Math.abs(size - px) < Math.abs((SIZE_LEVELS[best] ?? size) - px)) best = i;
  });
  return best;
}

type Read = (key: string) => string | null;

/** The saved size level; an older saved free-form size is carried over once. */
export function readSizeLevel(read: Read, legacyPrefsKey: string): number {
  const saved = read(SIZE_KEY);
  if (saved !== null) return clampLevel(saved, SIZE_LEVELS.length, DEFAULT_SIZE_LEVEL);
  try {
    const legacy = (JSON.parse(read(legacyPrefsKey) ?? '{}') as { size?: unknown }).size;
    return levelFromLegacySize(legacy) ?? DEFAULT_SIZE_LEVEL;
  } catch {
    return DEFAULT_SIZE_LEVEL;
  }
}

export function readLeadingLevel(read: Read): number {
  return clampLevel(read(LEADING_KEY), LEADING_LEVELS.length, DEFAULT_LEADING_LEVEL);
}
