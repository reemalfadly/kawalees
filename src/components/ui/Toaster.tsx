import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { useUI, type Toast } from '@/store/ui';

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useUI((s) => s.dismiss);
  const ms = t.duration ?? (t.action ? 6500 : 3800);
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(t.id), ms);
    return () => window.clearTimeout(timer);
  }, [t, ms, dismiss]);

  const Icon = t.tone === 'error' ? CircleAlert : t.tone === 'success' ? CircleCheck : Info;
  const tint =
    t.tone === 'error' ? 'text-bad' : t.tone === 'success' ? 'text-good' : 'text-accent-ink';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.96, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 460, damping: 34 }}
      className="acrylic pointer-events-auto relative flex w-full max-w-md items-center gap-3 overflow-hidden rounded-2xl py-3 ps-4 pe-3"
      role={t.tone === 'error' ? 'alert' : 'status'}
    >
      <span
        className="absolute inset-x-0 bottom-0 h-[2px] origin-right bg-accent-gradient opacity-70"
        style={{ animation: `toast-time ${ms}ms linear forwards` }}
        aria-hidden
      />
      <Icon
        size={20}
        className={`shrink-0 ${tint} animate-[pop-in_420ms_var(--ease-out)]`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{t.title}</p>
        {t.description && <p className="mt-0.5 text-xs text-ink-3">{t.description}</p>}
      </div>
      {t.action && (
        <button
          type="button"
          data-ripple
          className="shrink-0 rounded-xl bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-[color-mix(in_oklab,var(--accent)_22%,transparent)]"
          onClick={() => {
            t.action?.run();
            dismiss(t.id);
          }}
        >
          {t.action.label}
        </button>
      )}
    </motion.div>
  );
}

export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[70] flex flex-col items-center gap-2 px-4 bottom-[calc(env(safe-area-inset-bottom)+6.25rem)] md:bottom-6"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
