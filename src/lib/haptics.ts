// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
/* Light haptic ticks where the platform supports them (Android, some desktops).
   iOS Safari ignores vibrate(), so these are always optional polish. */

let enabled = true;

export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

function vibrate(pattern: number | number[]): void {
  if (!enabled) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

export const haptics = {
  tap: () => vibrate(8),
  success: () => vibrate([12, 40, 24]),
  warn: () => vibrate([30, 30, 30]),
};
