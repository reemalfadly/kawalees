import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'tonal' | 'secondary' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

/* Buttons: iOS proportions, Material press feedback (ripple + scale), Fluent depth.
   Primary glows with the accent and lifts on hover; tonal is the quiet sibling. */

const base =
  'relative inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap select-none ' +
  'transition-[transform,background-color,box-shadow,filter,color,border-color] duration-200 ease-out ' +
  'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45';

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm rounded-xl',
  md: 'h-11 px-5 text-[15px] rounded-[14px]',
  lg: 'h-13 px-7 text-base rounded-2xl',
};

const variants: Record<Variant, string> = {
  primary:
    'text-white bg-accent-gradient-strong ' +
    'shadow-[inset_0_1px_0_rgb(255_255_255/0.3),inset_0_-1px_0_rgb(0_0_0/0.12),0_1px_2px_rgb(0_0_0/0.18),0_10px_26px_-10px_var(--accent)] ' +
    'hover:brightness-110 hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.3),inset_0_-1px_0_rgb(0_0_0/0.12),0_2px_4px_rgb(0_0_0/0.18),0_16px_34px_-10px_var(--accent)] ' +
    '[@media(hover:hover)]:hover:-translate-y-px',
  tonal:
    'bg-accent-soft text-accent-ink hover:bg-[color-mix(in_oklab,var(--accent)_22%,transparent)]',
  secondary:
    'bg-surface-2 text-ink border border-line shadow-[var(--edge),0_1px_2px_rgb(0_0_0/0.06)] hover:bg-surface-3 hover:border-line-2',
  ghost: 'text-ink-2 hover:text-ink hover:bg-surface-2',
  outline: 'border border-line-2 text-ink hover:bg-surface-2',
  danger: 'bg-bad/12 text-bad hover:bg-bad/20',
};

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconEnd?: ReactNode;
  block?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconEnd,
  block,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      data-ripple
      className={cn(base, sizes[size], variants[variant], block && 'w-full', className)}
      {...rest}
    >
      {icon}
      {children}
      {iconEnd}
    </button>
  );
}

export interface IconButtonProps extends Omit<ComponentProps<'button'>, 'aria-label'> {
  label: string;
  variant?: 'ghost' | 'secondary' | 'primary' | 'tonal';
  size?: 'sm' | 'md' | 'lg';
}

const iconSizes = {
  sm: 'size-8 rounded-xl',
  md: 'size-10 rounded-[14px]',
  lg: 'size-12 rounded-2xl',
};

export function IconButton({
  label,
  variant = 'ghost',
  size = 'md',
  className,
  type = 'button',
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      data-tip={label}
      data-ripple
      className={cn(
        'inline-flex shrink-0 items-center justify-center transition-[transform,background-color,color,box-shadow] duration-200 active:scale-90 disabled:opacity-40',
        iconSizes[size],
        variant === 'ghost' && 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        variant === 'secondary' &&
          'border border-line bg-surface-2 text-ink shadow-[var(--edge),0_1px_2px_rgb(0_0_0/0.06)] hover:bg-surface-3',
        variant === 'tonal' && 'bg-accent-soft text-accent-ink',
        variant === 'primary' &&
          'bg-accent-gradient-strong text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_10px_26px_-10px_var(--accent)]',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
