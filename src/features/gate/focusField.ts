// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710

/* Where each gated field lives on the idea page. Text areas are focused directly;
   chip groups focus their first (or selected) button. */

export const FIELD_LABELS: Record<string, string> = {
  title: 'العنوان',
  platforms: 'المنصات',
  format: 'النوع',
  hook: 'الخطّاف',
  body: 'المحتوى',
  cta: 'الدعوة للتفاعل',
  proof: 'رابط الفيديو',
  publishedUrl: 'رابط المنشور',
};

const TARGET_IDS: Record<string, string> = {
  title: 'field-title',
  platforms: 'field-platforms',
  format: 'field-format',
  hook: 'field-hook',
  body: 'field-body',
  cta: 'field-cta',
};

/** Focus the control for `field` and scroll it into view. Returns false when it is not on screen. */
export function focusField(field: string): boolean {
  const id = TARGET_IDS[field];
  const host = id ? document.getElementById(id) : null;
  if (!host) return false;
  const target =
    host instanceof HTMLTextAreaElement || host instanceof HTMLInputElement
      ? host
      : (host.querySelector<HTMLElement>('button[aria-pressed="true"], button') ?? host);
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  target.focus({ preventScroll: true });
  host.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  return true;
}
