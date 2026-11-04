// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { describe, expect, it } from 'vitest';
import { invisibleMark, PROVENANCE, readInvisibleMark } from '@/lib/provenance';
import { exportBackup, parseBackup } from '@/lib/backup';

// Every source file, read as text.
const files = import.meta.glob(
  [
    '/src/**/*.{ts,tsx}',
    '/electron/**/*.cjs',
    '/scripts/**/*.mjs',
    '/tests/**/*.{ts,tsx}',
    '/*.config.ts',
    '/eslint.config.js',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

describe('authorship marks', () => {
  it('every source file carries the author notice (run `npm run stamp` to add it)', () => {
    const entries = Object.entries(files);
    expect(entries.length).toBeGreaterThan(80);
    const missing = entries
      .filter(([, text]) => !text.slice(0, 400).includes('KWL-RA-E20A3710'))
      .map(([path]) => path);
    expect(missing).toEqual([]);
  });

  it('the invisible mark is invisible, survives copy and reads back', () => {
    const mark = invisibleMark();
    expect([...mark].every((c) => [0x2063, 0x200b, 0x200c].includes(c.codePointAt(0) ?? 0))).toBe(
      true,
    );
    expect(readInvisibleMark(`جميع الحقوق محفوظة${mark}`)).toBe(PROVENANCE.id);
    expect(readInvisibleMark('plain text')).toBeNull();
  });

  it('exported backups name the author and still import', async () => {
    const backup = await exportBackup();
    expect(backup.author).toBe('Eng.Reem Alfadly');
    expect(readInvisibleMark(backup.mark ?? '')).toBe(PROVENANCE.id);
    expect(parseBackup(JSON.stringify(backup)).ok).toBe(true);
  });
});
