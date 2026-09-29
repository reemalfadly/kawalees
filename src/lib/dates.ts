/* Date helpers built on Intl so Arabic month and weekday names come from the
   platform. Day keys are local calendar days ("2026-09-28"), never UTC, so a
   post scheduled for today stays on today in every time zone. */

export const LOCALE = 'ar-KW-u-nu-latn';

export type WeekStart = 0 | 1 | 6;

const pad = (n: number) => String(n).padStart(2, '0');

export function toDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function todayKey(now: Date = new Date()): string {
  return toDayKey(now);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  return r;
}

export function addDaysKey(key: string, n: number): string {
  return toDayKey(addDays(fromDayKey(key), n));
}

export function diffDays(a: string, b: string): number {
  // Whole calendar days from b to a. Uses UTC maths on the calendar date to dodge DST.
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round(
    (Date.UTC(ay ?? 0, (am ?? 1) - 1, ad ?? 1) - Date.UTC(by ?? 0, (bm ?? 1) - 1, bd ?? 1)) /
      86_400_000,
  );
}

export function startOfWeek(d: Date, weekStartsOn: WeekStart): Date {
  const offset = (d.getDay() - weekStartsOn + 7) % 7;
  return addDays(d, -offset);
}

export function weekKeys(d: Date, weekStartsOn: WeekStart): string[] {
  const start = startOfWeek(d, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => toDayKey(addDays(start, i)));
}

/** Weeks (rows of 7 dates) covering the whole month, padded with neighbouring days. */
export function monthGrid(year: number, month: number, weekStartsOn: WeekStart): Date[][] {
  const first = new Date(year, month, 1);
  const start = startOfWeek(first, weekStartsOn);
  const last = new Date(year, month + 1, 0);
  const weeks: Date[][] = [];
  let cursor = start;
  while (cursor <= last || weeks.length < 5) {
    const week = Array.from({ length: 7 }, (_, i) => addDays(cursor, i));
    weeks.push(week);
    cursor = addDays(cursor, 7);
    if (weeks.length === 6) break;
  }
  return weeks;
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

const cache = new Map<string, Intl.DateTimeFormat>();
function dtf(options: Intl.DateTimeFormatOptions, locale = LOCALE): Intl.DateTimeFormat {
  const key = locale + JSON.stringify(options);
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options);
    cache.set(key, f);
  }
  return f;
}

export const formatDate = {
  weekdayShort: (d: Date) => dtf({ weekday: 'short' }).format(d),
  weekdayLong: (d: Date) => dtf({ weekday: 'long' }).format(d),
  dayMonth: (d: Date) => dtf({ day: 'numeric', month: 'long' }).format(d),
  dayMonthShort: (d: Date) => dtf({ day: 'numeric', month: 'short' }).format(d),
  monthName: (d: Date) => dtf({ month: 'long' }).format(d),
  monthYear: (d: Date) => dtf({ month: 'long', year: 'numeric' }).format(d),
  full: (d: Date) => dtf({ weekday: 'long', day: 'numeric', month: 'long' }).format(d),
  fullWithYear: (d: Date) =>
    dtf({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d),
  time: (d: Date) => dtf({ hour: 'numeric', minute: '2-digit' }).format(d),
  dateTime: (d: Date) =>
    dtf({ day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(d),
  hijri: (d: Date) =>
    dtf(
      { day: 'numeric', month: 'long', year: 'numeric' },
      'ar-SA-u-ca-islamic-umalqura-nu-latn',
    ).format(d),
};

export function formatTimeKey(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return formatDate.time(new Date(2000, 0, 1, h ?? 0, m ?? 0));
}

export function relativeDayLabel(key: string, now: Date = new Date()): string {
  const diff = diffDays(key, toDayKey(now));
  if (diff === 0) return 'اليوم';
  if (diff === 1) return 'بكرة';
  if (diff === -1) return 'أمس';
  if (diff > 1 && diff < 7) return formatDate.weekdayLong(fromDayKey(key));
  return formatDate.dayMonth(fromDayKey(key));
}

export function greeting(now: Date = new Date()): { text: string; emoji: string } {
  const h = now.getHours();
  if (h >= 5 && h < 12) return { text: 'صباح الخير', emoji: '☀️' };
  if (h >= 12 && h < 17) return { text: 'يسعد نهارك', emoji: '🌤️' };
  if (h >= 17 && h < 22) return { text: 'مساء الخير', emoji: '🌙' };
  return { text: 'ليل المبدعين', emoji: '✨' };
}

/** Weekday headers in display order for the chosen first day of the week. */
export function weekdayHeaders(weekStartsOn: WeekStart): { short: string; long: string }[] {
  // 2023-01-01 was a Sunday.
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2023, 0, 1 + ((weekStartsOn + i) % 7));
    return { short: formatDate.weekdayShort(d), long: formatDate.weekdayLong(d) };
  });
}
