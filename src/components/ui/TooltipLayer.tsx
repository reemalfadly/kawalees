import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/* Fluent-style tooltips for any element with data-tip="…". One layer serves the
   whole app: it appears after a short hover with a mouse, straight away on
   keyboard focus, and never on touch (where it would just get in the way). */

interface Tip {
  text: string;
  x: number;
  y: number;
  below: boolean;
}

const DELAY = 450;

export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const current = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const place = (el: HTMLElement): Tip | null => {
      const text = el.dataset.tip;
      if (!text) return null;
      const r = el.getBoundingClientRect();
      const below = r.top < 56;
      return { text, x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8, below };
    };
    const hide = () => {
      window.clearTimeout(timer.current);
      current.current = null;
      setTip(null);
    };
    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const el = (e.target as Element | null)?.closest<HTMLElement>('[data-tip]');
      if (!el || el === current.current) return;
      hide();
      current.current = el;
      timer.current = window.setTimeout(() => setTip(place(el)), DELAY);
    };
    const onOut = (e: PointerEvent) => {
      const el = current.current;
      if (el && !el.contains(e.relatedTarget as Node | null)) hide();
    };
    const onFocus = (e: FocusEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>('[data-tip]');
      if (!el || !el.matches(':focus-visible')) return;
      current.current = el;
      setTip(place(el));
    };
    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onOut);
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', hide);
    window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
      document.removeEventListener('pointerdown', hide, true);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', hide);
      window.removeEventListener('scroll', hide, true);
      window.clearTimeout(timer.current);
    };
  }, []);

  return createPortal(
    <AnimatePresence>
      {tip && (
        <motion.div
          key={`${tip.text}-${tip.x}`}
          role="tooltip"
          initial={{ opacity: 0, y: tip.below ? -4 : 4, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          className="acrylic pointer-events-none fixed z-[95] max-w-60 rounded-lg px-2.5 py-1.5 text-center text-xs font-medium whitespace-nowrap text-ink"
          style={{
            left: Math.min(Math.max(tip.x, 70), window.innerWidth - 70),
            top: tip.y,
            translate: tip.below ? '-50% 0' : '-50% -100%',
          }}
        >
          {tip.text}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
