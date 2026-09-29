import { MoreHorizontal, PenLine } from 'lucide-react';
import { useCallback, useRef, type CSSProperties, type HTMLAttributes } from 'react';
import { Link } from 'react-router';
import { Menu } from '@/components/ui/Menu';
import { PlatformStack } from '@/components/ui/PlatformIcon';
import { StageBadge } from '@/components/ui/StageBadge';
import { usePillars, useSettings } from '@/hooks/data';
import { FORMAT_META, STAGE_META } from '@/lib/catalog';
import { cn } from '@/lib/cn';
import { scriptWords, speakingSeconds, formatDuration } from '@/lib/script';
import type { Idea } from '@/lib/types';
import { ScheduleLabel, SparkFlames } from './IdeaRow';
import { useIdeaMenu } from './useIdeaMenu';

interface Props {
  idea: Idea;
  compact?: boolean;
  dragging?: boolean;
  overlay?: boolean;
  dragRef?: (el: HTMLDivElement | null) => void;
  dragProps?: HTMLAttributes<HTMLDivElement>;
  style?: CSSProperties;
  onLinkClick?: (e: React.MouseEvent) => void;
}

/** Idea card. The whole card is one link (stretched), with the menu layered above it. */
export function IdeaCard({
  idea,
  compact,
  dragging,
  overlay,
  dragRef,
  dragProps,
  style,
  onLinkClick,
}: Props) {
  const pillars = usePillars();
  const { wordsPerMinute } = useSettings();
  const items = useIdeaMenu(idea);
  const pillar = pillars.find((p) => p.id === idea.pillarId);
  const words = scriptWords(idea);
  const meta = STAGE_META[idea.stage];
  const cardRef = useRef<HTMLDivElement | null>(null);
  // One element, two owners: the drag sensor and the right-click menu.
  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      cardRef.current = el;
      dragRef?.(el);
    },
    [dragRef],
  );

  return (
    <div
      ref={setRefs}
      style={style}
      {...dragProps}
      data-spotlight={overlay ? undefined : ''}
      className={cn(
        'group relative isolate flex flex-col rounded-[20px] border border-line bg-solid/70 p-4 backdrop-blur-xl [&::before]:-z-10',
        'shadow-elev-1',
        'transition-[transform,border-color,box-shadow,opacity] duration-200',
        !overlay && 'hover:-translate-y-0.5 hover:border-line-2 hover:shadow-elev-2',
        dragging && 'opacity-35',
        overlay && 'rotate-[-2deg] scale-[1.03] cursor-grabbing border-line-2 shadow-elev-4',
        idea.archived && 'opacity-60',
      )}
    >
      <span
        className="absolute inset-y-4 start-0 w-[3px] rounded-e-full"
        style={{ background: meta.color }}
        aria-hidden
      />
      <div className="flex items-start gap-3">
        {!compact && (
          <span
            className="grid size-11 shrink-0 place-items-center rounded-[14px] text-xl"
            style={{ background: `color-mix(in oklab, ${meta.color} 16%, transparent)` }}
            aria-hidden
          >
            {FORMAT_META[idea.format].emoji}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <Link
            to={`/idea/${idea.id}`}
            onClick={onLinkClick}
            draggable={false}
            className="line-clamp-2 text-[15px] leading-6 font-semibold text-ink outline-none after:absolute after:inset-0 after:rounded-[20px] after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-accent-ink"
          >
            {idea.title || 'بدون عنوان'}
          </Link>
          {!compact && (
            <p className="mt-1 text-xs text-ink-3">
              {FORMAT_META[idea.format].label}
              {pillar && (
                <>
                  {' · '}
                  <span aria-hidden>{pillar.emoji}</span> {pillar.name}
                </>
              )}
            </p>
          )}
        </div>
        <div
          className="relative z-10 -me-1.5 -mt-1.5"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Menu
            label="خيارات الفكرة"
            items={items}
            contextTarget={overlay ? undefined : cardRef}
            trigger={(p) => (
              <button
                type="button"
                {...p}
                aria-label="خيارات الفكرة"
                className="grid size-8 place-items-center rounded-xl text-ink-3 opacity-100 transition-all hover:bg-surface-3 hover:text-ink md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 md:aria-expanded:opacity-100"
              >
                <MoreHorizontal size={18} />
              </button>
            )}
          />
        </div>
      </div>

      <div
        className={cn('flex flex-wrap items-center gap-x-2.5 gap-y-2', compact ? 'mt-3' : 'mt-4')}
      >
        {!compact && <StageBadge stage={idea.stage} />}
        <SparkFlames spark={idea.spark} />
        {words > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-ink-3">
            <PenLine size={12} />
            <span className="num">{formatDuration(speakingSeconds(words, wordsPerMinute))}</span>
          </span>
        )}
        <ScheduleLabel idea={idea} />
        <span className="ms-auto">
          <PlatformStack ids={idea.platforms} size={20} />
        </span>
      </div>
    </div>
  );
}
