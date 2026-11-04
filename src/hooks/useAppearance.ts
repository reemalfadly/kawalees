// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { useEffect } from 'react';
import type { AccentId, ThemePref } from '@/lib/types';

/* Applies theme + accent to <html> and mirrors them to localStorage, which the
   inline script in index.html reads to paint the right colours before React loads. */

const STORAGE_KEY = 'kawalees:appearance';

function apply(theme: ThemePref, accent: AccentId): void {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.accent = accent;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#07070c' : '#f6f4f0');
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme, accent }));
  } catch {
    /* private mode */
  }
}

export function useAppearance(theme: ThemePref, accent: AccentId): void {
  useEffect(() => {
    apply(theme, accent);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply(theme, accent);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme, accent]);
}
