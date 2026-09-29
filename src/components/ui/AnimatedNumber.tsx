import { animate } from 'motion/react';
import { useEffect, useRef } from 'react';
import { formatNumber } from '@/lib/format';

/* A number that counts to its value on first show and glides between values
   after that. Rendered as text from the start, so it is never blank. */
export function AnimatedNumber({
  value,
  format = formatNumber,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = format(value);
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration: Math.min(1.2, 0.45 + Math.abs(value - from.current) / 400),
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = format(Math.round(v));
      },
      onComplete: () => {
        from.current = value;
      },
    });
    return () => {
      controls.stop();
      from.current = value;
    };
  }, [value, format]);

  return (
    <span ref={ref} className={`num ${className ?? ''}`}>
      {format(value)}
    </span>
  );
}
