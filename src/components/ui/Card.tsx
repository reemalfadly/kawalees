// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/* Glass card. Every card carries a pointer-following spotlight on desktop;
   interactive ones also lift to the next elevation on hover. */
export function Card({
  className,
  interactive,
  padded = true,
  ...rest
}: ComponentProps<'div'> & { interactive?: boolean; padded?: boolean }) {
  return (
    <div
      data-spotlight
      className={cn(
        'glass isolate rounded-card [&::before]:-z-10',
        padded && 'p-5 sm:p-6',
        interactive &&
          'transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:border-line-2 hover:shadow-elev-2',
        className,
      )}
      {...rest}
    />
  );
}

export function SectionTitle({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
