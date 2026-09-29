/* Number formatting: Western digits, Arabic grouping, compact for big values. */

const compact = new Intl.NumberFormat('ar-KW-u-nu-latn', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const whole = new Intl.NumberFormat('ar-KW-u-nu-latn', { maximumFractionDigits: 0 });

export function formatNumber(n: number): string {
  return whole.format(n);
}

export function formatCompact(n: number): string {
  return Math.abs(n) < 10_000 ? whole.format(n) : compact.format(n);
}

export function formatSigned(n: number): string {
  if (n === 0) return '0';
  return `${n > 0 ? '+' : '−'}${formatCompact(Math.abs(n))}`;
}

/** Arabic plural-aware counts: "فكرة واحدة"، "فكرتين"، "3 أفكار"، "11 فكرة". */
export function plural(
  n: number,
  forms: { one: string; two: string; few: string; many: string },
): string {
  if (n === 0) return `0 ${forms.many}`;
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  const mod = n % 100;
  if (mod >= 3 && mod <= 10) return `${formatNumber(n)} ${forms.few}`;
  return `${formatNumber(n)} ${forms.many}`;
}

/** Just the noun for counts of 3 and up (the number is rendered separately). */
export function pluralWord(n: number, forms: { few: string; many: string }): string {
  const mod = n % 100;
  return mod >= 3 && mod <= 10 ? forms.few : forms.many;
}

export const WORDS = {
  idea: { one: 'فكرة وحدة', two: 'فكرتين', few: 'أفكار', many: 'فكرة' },
  post: { one: 'محتوى واحد', two: 'محتويين', few: 'محتويات', many: 'محتوى' },
  day: { one: 'يوم واحد', two: 'يومين', few: 'أيام', many: 'يوم' },
  week: { one: 'أسبوع واحد', two: 'أسبوعين', few: 'أسابيع', many: 'أسبوع' },
  word: { one: 'كلمة وحدة', two: 'كلمتين', few: 'كلمات', many: 'كلمة' },
  step: { one: 'خطوة وحدة', two: 'خطوتين', few: 'خطوات', many: 'خطوة' },
  entry: { one: 'تسجيل واحد', two: 'تسجيلين', few: 'تسجيلات', many: 'تسجيل' },
};
