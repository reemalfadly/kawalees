import { useId, type ReactNode } from 'react';

/* Circular meter with the accent gradient. The track is a quiet step of the
   surface so the filled arc carries the whole reading. */

export function ProgressRing({
  value,
  size = 120,
  stroke = 10,
  children,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  label: string;
}) {
  const id = `ring${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const clamped = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      className="relative inline-grid place-items-center"
      style={{ width: size, height: size }}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          style={{ transition: 'stroke-dashoffset 900ms var(--ease-out)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function ProgressBar({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div
      className={`relative h-2 overflow-hidden rounded-full bg-surface-3 ${className ?? ''}`}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <div
        className="absolute inset-y-0 start-0 rounded-full bg-accent-gradient transition-[width] duration-700 ease-out"
        style={{ width: `${clamped * 100}%` }}
      >
        <div className="shimmer absolute inset-0 rounded-full opacity-60" />
      </div>
    </div>
  );
}
