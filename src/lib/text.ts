/** Arabic-aware normalisation so "اداة" finds "أداة" and "فكره" finds "فكرة". */
export function normalizeArabic(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .trim();
}
