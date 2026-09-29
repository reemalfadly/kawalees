import {
  Camera,
  CircleCheckBig,
  Lightbulb,
  PenLine,
  Rocket,
  Scissors,
  type LucideIcon,
} from 'lucide-react';
import { STAGE_META } from '@/lib/catalog';
import { cn } from '@/lib/cn';
import type { Stage } from '@/lib/types';

export const STAGE_ICONS: Record<Stage, LucideIcon> = {
  idea: Lightbulb,
  script: PenLine,
  shoot: Camera,
  edit: Scissors,
  ready: CircleCheckBig,
  published: Rocket,
};

export function StageBadge({
  stage,
  className,
  size = 'sm',
}: {
  stage: Stage;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const meta = STAGE_META[stage];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-surface-2 font-medium text-ink-2',
        size === 'sm' ? 'h-6 px-2.5 text-xs' : 'h-8 px-3 text-sm',
        className,
      )}
    >
      <span className="size-2 rounded-full" style={{ background: meta.color }} aria-hidden />
      {meta.label}
    </span>
  );
}
