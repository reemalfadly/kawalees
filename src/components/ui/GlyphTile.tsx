// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

/* iOS-style icon tile: a gradient square with a white glyph and a glassy top edge. */

const sizes = {
  sm: { box: 'size-8 rounded-[10px]', icon: 16 },
  md: { box: 'size-10 rounded-xl', icon: 19 },
  lg: { box: 'size-14 rounded-[18px]', icon: 26 },
  xl: { box: 'size-20 rounded-[26px]', icon: 36 },
};

export function GlyphTile({
  icon: Icon,
  from = 'var(--accent)',
  to = 'var(--accent-2)',
  size = 'md',
  className,
}: {
  icon: LucideIcon;
  from?: string;
  to?: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const s = sizes[size];
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center text-white',
        s.box,
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(145deg, ${from}, ${to})`,
        boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.35), inset 0 -1px 0 rgb(0 0 0 / 0.12), 0 8px 20px -10px ${from}`,
      }}
    >
      <Icon size={s.icon} strokeWidth={2.1} />
    </span>
  );
}
