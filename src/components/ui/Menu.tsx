// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { AnimatePresence, motion } from 'motion/react';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

const GAP = 8;
const EDGE = 12;
const ITEM_HEIGHT = 44;

/* Action menu rendered in a portal with fixed positioning, so it is never
   clipped by a scrolling column or card. RTL-aware, flips upward when there
   is no room below, keyboard navigable, closes on outside tap, scroll or Escape. */
export function Menu({
  trigger,
  items,
  align = 'end',
  label,
  contextTarget,
}: {
  trigger: (props: {
    onClick: (e: React.MouseEvent<HTMLElement>) => void;
    'aria-expanded': boolean;
    'aria-haspopup': 'menu';
  }) => ReactNode;
  items: MenuItem[];
  align?: 'start' | 'end';
  label: string;
  /** Also open this menu at the pointer on right-click / long-press of this element. */
  contextTarget?: RefObject<HTMLElement | null>;
}) {
  const [pos, setPos] = useState<{ style: CSSProperties; up: boolean } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const open = pos !== null;

  // Positions from the clicked trigger itself (not a ref), so it's safe to hand to render props.
  const toggle = (e: React.MouseEvent<HTMLElement>) => {
    if (open) {
      setPos(null);
      return;
    }
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const rtl = getComputedStyle(el).direction === 'rtl';
    const height = items.length * ITEM_HEIGHT + 12;
    const up =
      rect.bottom + GAP + height > window.innerHeight - EDGE && rect.top - GAP - height > EDGE;
    // "end" is the left edge in RTL and the right edge in LTR.
    const alignLeft = (align === 'end') === rtl;
    const style: CSSProperties = {
      position: 'fixed',
      ...(up ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
      ...(alignLeft
        ? { left: Math.max(EDGE, rect.left) }
        : { right: Math.max(EDGE, window.innerWidth - rect.right) }),
    };
    setPos({ style, up });
  };

  // Desktop context menu: open where the pointer is, like a native app.
  useEffect(() => {
    const target = contextTarget?.current;
    if (!target) return;
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      const height = items.length * ITEM_HEIGHT + 12;
      const width = 240;
      const rtl = getComputedStyle(target).direction === 'rtl';
      const up = e.clientY + height > window.innerHeight - EDGE;
      const openLeft = rtl
        ? e.clientX - width > EDGE
        : e.clientX + width > window.innerWidth - EDGE;
      setPos({
        up,
        style: {
          position: 'fixed',
          ...(up ? { bottom: window.innerHeight - e.clientY } : { top: e.clientY }),
          ...(openLeft
            ? { right: Math.max(EDGE, window.innerWidth - e.clientX) }
            : { left: Math.max(EDGE, e.clientX) }),
        },
      });
    };
    target.addEventListener('contextmenu', onContext);
    return () => target.removeEventListener('contextmenu', onContext);
  }, [contextTarget, items.length]);

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !listRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const buttons = [
          ...(listRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []),
        ];
        const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next =
          e.key === 'ArrowDown'
            ? (idx + 1) % buttons.length
            : (idx - 1 + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }
    };
    // Close on a real scroll only: phones nudge the page a few pixels when a tap
    // focuses something, and that must not snap the menu shut.
    const startY = window.scrollY;
    const onScroll = (e: Event) => {
      const t = e.target as Node;
      if (listRef.current?.contains(t)) return;
      const pageScroll = t === document || t === document.documentElement || t === document.body;
      if (pageScroll && Math.abs(window.scrollY - startY) < 24) return;
      close();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    const t = window.setTimeout(
      () => listRef.current?.querySelector<HTMLButtonElement>('button')?.focus(),
      30,
    );
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
      window.clearTimeout(t);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      {trigger({ onClick: toggle, 'aria-expanded': open, 'aria-haspopup': 'menu' })}
      {createPortal(
        <AnimatePresence>
          {pos && (
            <motion.div
              ref={listRef}
              role="menu"
              aria-label={label}
              style={pos.style}
              initial={{ opacity: 0, scale: 0.95, y: pos.up ? 4 : -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
              transition={{ type: 'spring', stiffness: 520, damping: 34 }}
              className={cn(
                'acrylic z-[75] max-h-[70dvh] max-w-[min(20rem,calc(100vw-1.5rem))] min-w-52 overflow-y-auto rounded-2xl p-1.5',
                pos.up ? 'origin-bottom' : 'origin-top',
              )}
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setPos(null);
                    item.onSelect();
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm font-medium outline-none transition-colors',
                    'focus-visible:bg-surface-2 disabled:opacity-40',
                    item.danger ? 'text-bad hover:bg-bad/10' : 'text-ink hover:bg-surface-2',
                  )}
                >
                  {item.icon && (
                    <span className={cn('shrink-0', item.danger ? 'text-bad' : 'text-ink-3')}>
                      {item.icon}
                    </span>
                  )}
                  {item.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
