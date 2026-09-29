import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { GlyphTile } from './GlyphTile';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
  level = 3,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
  /** Use 1 when the empty state is the whole page. */
  level?: 1 | 2 | 3;
}) {
  const Heading = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center',
        compact ? 'py-8' : 'py-14',
        className,
      )}
    >
      <div className="relative mb-5">
        <div
          className="absolute inset-0 -z-10 scale-150 rounded-full bg-accent-soft blur-2xl"
          aria-hidden
        />
        <GlyphTile
          icon={icon}
          size={compact ? 'lg' : 'xl'}
          className="animate-[float_5s_ease-in-out_infinite]"
        />
      </div>
      <Heading className="text-lg font-semibold text-ink">{title}</Heading>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-6 text-ink-3">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
