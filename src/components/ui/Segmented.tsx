import { motion } from 'motion/react';
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentOption<T>[];
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'relative inline-flex rounded-2xl border border-line bg-surface-2 p-1',
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative z-10 inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl font-medium whitespace-nowrap transition-colors duration-200',
              size === 'md' ? 'h-9 px-4 text-sm' : 'h-8 px-3 text-[13px]',
              active ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 -z-10 rounded-xl border border-line bg-solid shadow-[0_2px_10px_-4px_rgb(0_0_0/0.35)]"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
