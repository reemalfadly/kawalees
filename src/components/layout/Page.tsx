import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useSettings } from '@/hooks/data';
import { cn } from '@/lib/cn';

export function Page({
  children,
  className,
  wide,
}: {
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 sm:px-6 md:px-8',
        wide ? 'max-w-[1480px]' : 'max-w-[1180px]',
        className,
      )}
    >
      {children}
    </div>
  );
}

/* iOS large title: a big heading at the top of the page that hands over to a
   compact, blurred navigation bar once it scrolls away (phones only). */
export function PageHeader({
  eyebrow,
  title,
  compactTitle,
  subtitle,
  actions,
  hideProfile,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Plain-text title for the compact bar; defaults to `title` when it is a string. */
  compactTitle?: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  hideProfile?: boolean;
}) {
  const settings = useSettings();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const small = compactTitle ?? (typeof title === 'string' ? title : '');

  useEffect(() => {
    const el = titleRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) =>
        setCollapsed(!!entry && !entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0, rootMargin: '-8px 0px 0px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const avatar = !hideProfile && (
    <Link
      to="/settings"
      aria-label="الإعدادات والملف الشخصي"
      data-ripple
      className="glass grid size-11 place-items-center rounded-full text-xl transition-transform active:scale-90 md:hidden"
    >
      <span aria-hidden>{settings.avatar}</span>
    </Link>
  );

  return (
    <header className="pt-[max(1.25rem,env(safe-area-inset-top))] pb-6 md:pt-10 md:pb-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1.5 text-sm font-medium text-ink-3">{eyebrow}</p>}
          <h1
            ref={titleRef}
            className="font-display text-[2rem] leading-tight font-bold tracking-[-0.015em] text-ink md:text-[2.6rem]"
          >
            {title}
          </h1>
          {subtitle && <p className="mt-2 text-[15px] text-ink-2">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {avatar}
        </div>
      </div>

      <AnimatePresence>
        {collapsed && small && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-0 z-30 border-b border-line bg-[color-mix(in_oklab,var(--bg)_72%,transparent)] pt-[env(safe-area-inset-top)] backdrop-blur-2xl backdrop-saturate-150 md:hidden"
            aria-hidden
          >
            <motion.p
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="flex h-12 items-center justify-center px-16 text-center text-[17px] font-semibold text-ink"
            >
              <span className="truncate">{small}</span>
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
