// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { useLayoutEffect, useRef, useState } from 'react';

/** Tracks an element's width so SVG charts can draw at real pixel sizes. */
export function useWidth<T extends HTMLElement>(fallback = 600) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  // Layout effect: measure before the first paint so a chart never draws at the fallback width.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const initial = Math.round(el.getBoundingClientRect().width);
    if (initial) setWidth(initial);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}
