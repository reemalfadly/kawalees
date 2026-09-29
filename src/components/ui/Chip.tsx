import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Chip({
  selected,
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: ComponentProps<'button'> & { selected?: boolean; icon?: ReactNode }) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      data-ripple
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium',
        'transition-[background-color,border-color,color,transform] duration-200 active:scale-95',
        selected
          ? 'border-transparent bg-accent-soft text-accent-ink shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--accent)_30%,transparent)]'
          : 'border-line text-ink-2 hover:bg-surface-2 hover:text-ink',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export function Tag({
  children,
  className,
  color,
}: {
  children: ReactNode;
  className?: string;
  color?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full bg-surface-2 px-2.5 text-xs font-medium text-ink-2',
        className,
      )}
    >
      {color && (
        <span className="size-1.5 rounded-full" style={{ background: color }} aria-hidden />
      )}
      {children}
    </span>
  );
}
