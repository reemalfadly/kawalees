import { CalendarClock, ChevronLeft, Flame } from 'lucide-react';
import { Link } from 'react-router';
import { PlatformStack } from '@/components/ui/PlatformIcon';
import { StageBadge } from '@/components/ui/StageBadge';
import { FORMAT_META, STAGE_META } from '@/lib/catalog';
import { cn } from '@/lib/cn';
import { formatTimeKey, relativeDayLabel } from '@/lib/dates';
import type { Idea } from '@/lib/types';

export function SparkFlames({
  spark,
  className,
}: {
  spark: 1 | 2 | 3 | number;
  className?: string;
}) {
  return (
    <span
      className={cn('inline-flex items-center gap-0.5 text-accent-ink', className)}
      aria-label={`قوة الفكرة ${spark} من 3`}
    >
      {Array.from({ length: spark }, (_, i) => (
        <Flame key={i} size={13} fill="currentColor" strokeWidth={0} />
      ))}
    </span>
  );
}

export function ScheduleLabel({ idea, className }: { idea: Idea; className?: string }) {
  if (!idea.scheduledFor) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs text-ink-3', className)}>
      <CalendarClock size={13} />
      {relativeDayLabel(idea.scheduledFor)}
      {idea.scheduledTime && <span className="num">· {formatTimeKey(idea.scheduledTime)}</span>}
    </span>
  );
}

/** A compact, tappable idea line used on Home and in lists. */
export function IdeaRow({
  idea,
  showNext,
  className,
}: {
  idea: Idea;
  showNext?: boolean;
  className?: string;
}) {
  const meta = STAGE_META[idea.stage];
  return (
    <Link
      to={`/idea/${idea.id}`}
      className={cn(
        'group flex items-center gap-3.5 rounded-2xl px-3 py-3 transition-colors hover:bg-surface-2 focus-visible:bg-surface-2',
        className,
      )}
    >
      <span
        className="grid size-11 shrink-0 place-items-center rounded-[14px] text-xl"
        style={{ background: `color-mix(in oklab, ${meta.color} 16%, transparent)` }}
        aria-hidden
      >
        {FORMAT_META[idea.format].emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-1 text-[15px] font-medium text-ink">
          {idea.title || 'بدون عنوان'}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <StageBadge stage={idea.stage} />
          {showNext && meta.verb && <span className="text-xs text-ink-3">التالي: {meta.verb}</span>}
          <ScheduleLabel idea={idea} />
        </span>
      </span>
      <PlatformStack ids={idea.platforms} size={22} />
      <ChevronLeft
        size={18}
        className="shrink-0 text-ink-3 transition-transform group-hover:-translate-x-0.5"
      />
    </Link>
  );
}
