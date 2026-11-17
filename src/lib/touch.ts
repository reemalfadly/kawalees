// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710

/* Touch targets without changing the look: an invisible pseudo-element grows the
   tappable area of small links and buttons to 44px. The element must not clip it. */

/** Small text links (about 20px tall): +12px above and below. */
export const HIT_LINK =
  "relative before:absolute before:-inset-x-2 before:-inset-y-3 before:content-['']";

/** 32px icon buttons: +6px on every side. */
export const HIT_ICON = "relative before:absolute before:-inset-1.5 before:content-['']";

/** 36px buttons: +4px above and below. */
export const HIT_BUTTON =
  "relative before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']";

/** Same as HIT_ICON for elements that are already positioned (absolute or fixed). */
export const HIT_ICON_POSITIONED = "before:absolute before:-inset-1.5 before:content-['']";
