// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { AUTHOR, COPYRIGHT_YEAR, LINKS } from './about';

/* Proof of authorship. Marks that stay with the app wherever it goes: a visible signature in the
   page and the console, an invisible watermark in the About text, and the author inside every
   exported backup. They don't stop copying (nothing in a downloadable app can), but a copy that
   keeps any of them is identifiable as Eng.Reem Alfadly's work. The full list of marks, and how
   to search for them, is kept privately. */

export const PROVENANCE = {
  product: 'Kawalees',
  author: AUTHOR,
  year: COPYRIGHT_YEAR,
  repo: LINKS.home,
  id: 'KWL-RA-26E442F3',
} as const;

// Built from code points so no invisible character sits in this source file.
const SEP = String.fromCodePoint(0x2063); // invisible separator
const ZERO = String.fromCodePoint(0x200b); // zero-width space = 0
const ONE = String.fromCodePoint(0x200c); // zero-width non-joiner = 1

/** The id written as zero-width characters (invisible, but survives copy and paste). */
export function invisibleMark(text: string = PROVENANCE.id): string {
  const bits = [...text].map((c) => c.charCodeAt(0).toString(2).padStart(8, '0')).join('');
  return SEP + [...bits].map((b) => (b === '1' ? ONE : ZERO)).join('') + SEP;
}

/** Reads a mark back out of any text, e.g. a string found in a suspect copy. */
export function readInvisibleMark(text: string): string | null {
  const start = text.indexOf(SEP);
  const end = start < 0 ? -1 : text.indexOf(SEP, start + 1);
  if (end < 0) return null;
  const body = [...text.slice(start + 1, end)];
  if (body.length === 0 || body.length % 8 !== 0) return null;
  const bits = body.map((c) => (c === ONE ? '1' : '0')).join('');
  return (bits.match(/.{8}/g) ?? []).map((b) => String.fromCharCode(parseInt(b, 2))).join('');
}

/** Called once at start-up. */
export function stampDocument(): void {
  document.documentElement.dataset.author = PROVENANCE.author;
  Object.defineProperty(window, '__kawalees', {
    value: Object.freeze({ ...PROVENANCE, version: __APP_VERSION__ }),
    enumerable: false,
  });
  // eslint-disable-next-line no-console
  console.info(
    `%cKawalees%c  by ${PROVENANCE.author}  ·  © ${PROVENANCE.year}  ·  ${PROVENANCE.id}`,
    'font:700 14px system-ui;color:#ff6b3d',
    'font:12px system-ui;color:#9a8f98',
  );
}
