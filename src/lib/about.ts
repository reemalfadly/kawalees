// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
/* Ownership and links shown in the app, the installers and the README. One place to change them. */

export const AUTHOR = 'Eng.Reem Alfadly';
export const COPYRIGHT_YEAR = 2026;
export const COPYRIGHT = `© ${COPYRIGHT_YEAR} ${AUTHOR}`;

const REPO = 'https://github.com/reemalfadly/kawalees';
export const LINKS = {
  home: REPO,
  license: `${REPO}/blob/main/LICENSE`,
  releases: `${REPO}/releases/latest`,
};

/* Support channel. Leave empty to hide every contact button in the app. */
export const TELEGRAM_URL = 'https://t.me/+_UVsX7LbVqIxM2M0';

/* The two promises the app makes about connectivity and privacy, worded once so every screen,
   the install guide and the README say the same thing. */
export const OFFLINE_NOTE = 'يعمل بدون إنترنت، عدا وضع «يتبع الصوت» الذي يحتاج اتصالاً';
export const PRIVACY_NOTE =
  'بياناتك على جهازك، ولا حسابات ولا تتبع. وضع «يتبع الصوت» وحده يمر عبر مزوّد المتصفح.';
export const INSTALL_SAVES_NOTE = 'تثبيت التطبيق يحمي أفكارك من الضياع';
