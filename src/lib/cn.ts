import { twMerge } from 'tailwind-merge';

/** Joins class names, skipping falsy values; later Tailwind classes win over earlier conflicting ones. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return twMerge(parts.filter(Boolean).join(' '));
}
