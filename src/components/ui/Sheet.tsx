// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { X } from 'lucide-react';
import { AnimatePresence, motion, useDragControls } from 'motion/react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useIsTablet } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/cn';
import { modalOpened } from '@/lib/modal';
import { IconButton } from './Button';

/* One modal primitive for every form factor: a draggable bottom sheet on phones,
   a centred dialog on tablets and desktops. Traps focus, closes on Escape, and
   hands focus back to whatever opened it. */

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
  initialFocus?: 'first' | 'none';
}

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  initialFocus = 'first',
}: SheetProps) {
  const wide = useIsTablet();
  const panelRef = useRef<HTMLDivElement>(null);
  const controls = useDragControls();
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const release = modalOpened();
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target =
        initialFocus === 'first'
          ? (panel.querySelector<HTMLElement>('[data-autofocus]') ??
            panel.querySelector<HTMLElement>('input,textarea'))
          : null;
      (target ?? panel).focus({ preventScroll: true });
    }, 60);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null,
      );
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      release();
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey, true);
      root.style.overflow = prevOverflow;
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open, initialFocus]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
          <motion.div
            className="absolute inset-0 bg-scrim backdrop-blur-[6px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            className={cn(
              'glass-strong relative flex max-h-[92dvh] w-full flex-col shadow-elev-4 outline-none',
              'rounded-t-[28px] md:rounded-[28px]',
              size === 'md' ? 'md:max-w-lg' : 'md:max-w-2xl',
            )}
            initial={wide ? { opacity: 0, scale: 0.96, y: 10 } : { y: '100%' }}
            animate={wide ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={wide ? { opacity: 0, scale: 0.97, y: 6 } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 0.9 }}
            drag={wide ? false : 'y'}
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 650) onClose();
            }}
          >
            <div
              className="flex shrink-0 touch-none flex-col px-5 pt-2.5 md:px-6 md:pt-5"
              onPointerDown={(e) => {
                if (!wide) controls.start(e);
              }}
            >
              <span
                className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line-2 md:hidden"
                aria-hidden
              />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 pt-1">
                  <h2 id={titleId} className="text-xl font-semibold text-ink">
                    {title}
                  </h2>
                  {description && (
                    <p id={descId} className="mt-1 text-sm text-ink-3">
                      {description}
                    </p>
                  )}
                </div>
                <IconButton
                  label="إغلاق"
                  size="sm"
                  variant="secondary"
                  onClick={onClose}
                  className="rounded-full"
                >
                  <X size={16} />
                </IconButton>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-5 md:px-6">
              {children}
            </div>
            {footer && (
              <div className="shrink-0 border-t border-line px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6 md:pb-5">
                {footer}
              </div>
            )}
            {!footer && <div className="pb-[env(safe-area-inset-bottom)]" />}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
