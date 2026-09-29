import { useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

const control =
  'w-full rounded-[14px] border border-line bg-surface-2 text-[15px] text-ink outline-none ' +
  'transition-[border-color,background-color,box-shadow] duration-200 ' +
  'hover:border-line-2 focus:border-accent focus:bg-surface-3 focus:shadow-[0_0_0_4px_var(--accent-softer)]';

export function Input({ className, ...rest }: ComponentProps<'input'>) {
  return <input className={cn(control, 'h-12 px-4', className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(control, 'min-h-28 resize-none px-4 py-3 leading-7', className)}
      {...rest}
    />
  );
}

export function Select({ className, children, ...rest }: ComponentProps<'select'>) {
  return (
    <select className={cn(control, 'h-12 appearance-none px-4', className)} {...rest}>
      {children}
    </select>
  );
}

/** Label + control + hint, wired together for screen readers. */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink-2">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line bg-surface-2 px-1.5 font-sans text-[11px] font-medium text-ink-3">
      {children}
    </kbd>
  );
}
