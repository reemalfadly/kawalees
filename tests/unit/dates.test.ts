import { describe, expect, it } from 'vitest';
import {
  addDaysKey,
  diffDays,
  fromDayKey,
  greeting,
  monthGrid,
  startOfWeek,
  toDayKey,
  weekKeys,
  weekdayHeaders,
} from '@/lib/dates';

describe('day keys', () => {
  it('round-trips local calendar days', () => {
    expect(toDayKey(new Date(2026, 8, 28, 23, 59))).toBe('2026-09-28');
    expect(toDayKey(fromDayKey('2026-01-05'))).toBe('2026-01-05');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDaysKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysKey('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('counts whole days between keys', () => {
    expect(diffDays('2026-09-28', '2026-09-21')).toBe(7);
    expect(diffDays('2026-01-01', '2026-12-31')).toBe(-364);
    expect(diffDays('2026-09-28', '2026-09-28')).toBe(0);
  });
});

describe('weeks', () => {
  // 2026-09-28 is a Monday.
  const monday = new Date(2026, 8, 28);

  it('starts the week on the chosen day', () => {
    expect(toDayKey(startOfWeek(monday, 0))).toBe('2026-09-27');
    expect(toDayKey(startOfWeek(monday, 1))).toBe('2026-09-28');
    expect(toDayKey(startOfWeek(monday, 6))).toBe('2026-09-26');
  });

  it('lists the seven days of the week', () => {
    const keys = weekKeys(monday, 0);
    expect(keys).toHaveLength(7);
    expect(keys[0]).toBe('2026-09-27');
    expect(keys[6]).toBe('2026-10-03');
  });

  it('builds a month grid that covers every day of the month', () => {
    const grid = monthGrid(2026, 8, 0);
    const days = grid.flat().map(toDayKey);
    expect(days).toContain('2026-09-01');
    expect(days).toContain('2026-09-30');
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid.length).toBeGreaterThanOrEqual(5);
    expect(grid.length).toBeLessThanOrEqual(6);
  });

  it('orders weekday headers from the first day of the week', () => {
    expect(weekdayHeaders(6)[0]?.long).toBe('السبت');
    expect(weekdayHeaders(0)[0]?.long).toBe('الأحد');
  });
});

describe('greeting', () => {
  it('matches the time of day', () => {
    expect(greeting(new Date(2026, 0, 1, 8)).text).toBe('صباح الخير');
    expect(greeting(new Date(2026, 0, 1, 19)).text).toBe('مساء الخير');
    expect(greeting(new Date(2026, 0, 1, 2)).emoji).toBe('✨');
  });
});
