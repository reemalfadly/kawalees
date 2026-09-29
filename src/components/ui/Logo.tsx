import { useId } from 'react';
import { cn } from '@/lib/cn';

/* The كواليس mark: a rounded play shape (the video) with a spark (the idea).
   In the app it follows the chosen accent; the installed icon uses ember. */

export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  const id = `logo${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--accent-2)" />
        </linearGradient>
        <radialGradient id={`${id}-sheen`} cx="0.3" cy="0.15" r="0.9">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${id}-bg)`} />
      <rect width="64" height="64" rx="18" fill={`url(#${id}-sheen)`} />
      <path
        d="M24 22.2c0-2.4 2.6-3.9 4.7-2.7l15.6 9.1c2 1.2 2 4.1 0 5.3l-15.6 9.1c-2.1 1.2-4.7-.3-4.7-2.7z"
        fill="#fff"
      />
      <path
        d="M46.5 9.5c.7 3.9 2.1 5.3 6 6-3.9.7-5.3 2.1-6 6-.7-3.9-2.1-5.3-6-6 3.9-.7 5.3-2.1 6-6z"
        fill="#fff"
        opacity="0.95"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={34} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.35rem] font-bold tracking-tight text-ink">
          كواليس
        </span>
        <span className="mt-1 text-[10px] font-medium tracking-[0.18em] text-ink-3 uppercase">
          Creator Studio
        </span>
      </span>
    </span>
  );
}
