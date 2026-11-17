// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { Check, RotateCcw } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';
import { formatDuration } from '@/lib/script';

/* What the filming screen shows on top of the script besides the controls:
   the 3-2-1 countdown, the section chips and the closing card. Everything here moves with
   transform and opacity only, and goes still for reduced motion. */

/** Easing used across the screen: quick start, long soft landing. */
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export function Countdown({ value }: { value: number | null }) {
  const reduce = useReducedMotion();
  return (
    <div
      className="pointer-events-none fixed inset-0 z-30 grid place-items-center"
      role="status"
      aria-live="assertive"
    >
      <AnimatePresence>
        {value !== null && value > 0 && (
          <motion.div
            key="scrim"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.35 }}
            className="absolute inset-0 bg-[#050507]/60"
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {value !== null && value > 0 && (
          <motion.div
            key={value}
            initial={reduce ? false : { opacity: 0, scale: 1.45 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={
              reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.78 }
            }
            transition={{ duration: reduce ? 0 : 0.34, ease: EASE_OUT }}
            className="absolute grid place-items-center"
          >
            {!reduce && (
              <motion.span
                aria-hidden
                className="absolute size-44 rounded-full border border-[var(--accent)]/50"
                initial={{ opacity: 0.55, scale: 0.7 }}
                animate={{ opacity: 0, scale: 1.5 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            )}
            <span className="num font-display text-[9rem] leading-none font-bold text-gradient">
              {value}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {value !== null && value > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : 0.25 }}
            className="absolute top-[calc(50%+7rem)] rounded-full bg-white/10 px-4 py-1.5 text-center text-sm text-white/70 backdrop-blur-xl"
          >
            لمسة للإلغاء
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export interface Chip {
  key: string;
  label: string;
}

/**
 * Quick jumps between sections. The visible name is drawn from `data-label` so it is not a second
 * text node next to the section heading itself; the accessible name says what the chip does.
 */
export function SectionChips({
  chips,
  active,
  onJump,
}: {
  chips: Chip[];
  active: number;
  onJump: (index: number) => void;
}) {
  if (chips.length < 2) return null;
  return (
    <nav aria-label="أقسام النص" className="flex items-center justify-center gap-1">
      {chips.map((c, i) => (
        <button
          key={c.key}
          type="button"
          aria-label={`الانتقال إلى ${c.label}`}
          aria-current={i === active ? 'true' : undefined}
          onClick={() => onJump(i)}
          className="group grid min-h-11 min-w-11 place-items-center"
        >
          <span
            data-label={c.label}
            className={cn(
              'flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium backdrop-blur-xl transition-[background-color,color,transform] duration-300 group-active:scale-95',
              'after:content-[attr(data-label)]',
              i === active ? 'bg-white/20 text-white' : 'bg-white/[0.08] text-white/65',
            )}
          />
        </button>
      ))}
    </nav>
  );
}

/** The closing card: shown once the last line has been read. */
export function FinishCard({
  seconds,
  onRestart,
  onDone,
}: {
  seconds: number;
  onRestart: () => void;
  onDone: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      aria-label="انتهى النص"
      initial={reduce ? false : { opacity: 0, y: 28, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: 16 }}
      transition={{ duration: reduce ? 0 : 0.5, ease: EASE_OUT }}
      className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4 rounded-[28px] border border-white/10 bg-white/[0.07] px-6 pt-7 pb-5 text-center backdrop-blur-2xl">
        <div className="relative grid size-16 place-items-center">
          {!reduce && (
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full border border-[var(--accent)]/60"
              initial={{ opacity: 0.6, scale: 0.9 }}
              animate={{ opacity: 0, scale: 1.7 }}
              transition={{ duration: 1.1, ease: 'easeOut', delay: 0.2 }}
            />
          )}
          <motion.span
            initial={reduce ? false : { scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={
              reduce
                ? { duration: 0 }
                : { type: 'spring', stiffness: 260, damping: 16, delay: 0.12 }
            }
            className="grid size-16 place-items-center rounded-full bg-accent-gradient-strong text-white shadow-[0_12px_30px_-10px_var(--accent)]"
          >
            <Check size={30} strokeWidth={3} />
          </motion.span>
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold text-white">انتهى النص</h2>
          {seconds > 0 && (
            <p className="mt-1 text-sm text-white/60">
              مدّة القراءة{' '}
              <span className="num font-semibold text-white/85">{formatDuration(seconds)}</span>
            </p>
          )}
        </div>
        <div className="flex w-full gap-2.5">
          <button
            type="button"
            onClick={onRestart}
            aria-label="من البداية"
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 text-[15px] font-semibold text-white transition active:scale-[0.97]"
          >
            <RotateCcw size={18} />
            من البداية
          </button>
          <button
            type="button"
            onClick={onDone}
            aria-label="تم"
            className="min-h-12 flex-1 rounded-2xl bg-accent-gradient-strong px-4 text-[15px] font-semibold text-white transition active:scale-[0.97]"
          >
            تم
          </button>
        </div>
      </div>
    </motion.section>
  );
}
