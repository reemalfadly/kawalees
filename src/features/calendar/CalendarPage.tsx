import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CalendarCheck2, ChevronLeft, ChevronRight, GripVertical, Inbox, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Page, PageHeader } from '@/components/layout/Page';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PlatformStack } from '@/components/ui/PlatformIcon';
import { StageBadge } from '@/components/ui/StageBadge';
import { useLiveIdeas, useSettings } from '@/hooks/data';
import { useIsTablet } from '@/hooks/useMediaQuery';
import { FORMAT_META, STAGE_META } from '@/lib/catalog';
import { cn } from '@/lib/cn';
import {
  formatDate,
  formatTimeKey,
  fromDayKey,
  monthGrid,
  relativeDayLabel,
  toDayKey,
  todayKey,
  weekdayHeaders,
} from '@/lib/dates';
import { plural, WORDS } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { scheduleIdea } from '@/lib/repo';
import { publishedDayKey } from '@/lib/stats';
import type { Idea } from '@/lib/types';
import { toast, useUI } from '@/store/ui';

/* Month view of the publishing plan. Drag ideas from the tray onto a day (or
   between days) to schedule them; tap a day to see and add to it. */

let lastDragEnd = 0;

function dayOf(idea: Idea): string | null {
  return idea.stage === 'published'
    ? (publishedDayKey(idea) ?? idea.scheduledFor)
    : idea.scheduledFor;
}

function sortByTime(a: Idea, b: Idea) {
  return (a.scheduledTime ?? '99').localeCompare(b.scheduledTime ?? '99');
}

export default function CalendarPage() {
  const ideas = useLiveIdeas();
  const settings = useSettings();
  const tablet = useIsTablet();
  const openCapture = useUI((s) => s.openCapture);
  const today = todayKey();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [selected, setSelected] = useState(today);
  const [dir, setDir] = useState(0);
  const [dragging, setDragging] = useState<Idea | null>(null);

  const weeks = useMemo(
    () => monthGrid(cursor.y, cursor.m, settings.weekStartsOn),
    [cursor, settings.weekStartsOn],
  );
  const byDay = useMemo(() => {
    const map = new Map<string, Idea[]>();
    for (const i of ideas) {
      const d = dayOf(i);
      if (!d) continue;
      map.set(d, [...(map.get(d) ?? []), i]);
    }
    for (const list of map.values()) list.sort(sortByTime);
    return map;
  }, [ideas]);
  const unscheduled = ideas
    .filter((i) => !i.scheduledFor && i.stage !== 'published')
    .sort((a, b) => b.spark - a.spark || b.updatedAt - a.updatedAt);

  const monthDate = new Date(cursor.y, cursor.m, 1);
  const inMonth = ideas.filter((i) => {
    const d = dayOf(i);
    return d?.startsWith(toDayKey(monthDate).slice(0, 7));
  });

  const shift = (delta: number) => {
    setDir(delta);
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };
  const goToday = () => {
    const d = new Date();
    setDir(0);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
    setSelected(today);
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const onStart = (e: DragStartEvent) => {
    setDragging((e.active.data.current?.idea as Idea | undefined) ?? null);
    haptics.tap();
  };
  const onEnd = async (e: DragEndEvent) => {
    lastDragEnd = Date.now();
    setDragging(null);
    const idea = e.active.data.current?.idea as Idea | undefined;
    const target = e.over?.id;
    if (!idea || typeof target !== 'string') return;
    if (target === 'tray') {
      if (idea.scheduledFor && idea.stage !== 'published') {
        await scheduleIdea(idea.id, null);
        toast({
          title: 'انشالت من الجدول',
          action: {
            label: 'تراجع',
            run: () => void scheduleIdea(idea.id, idea.scheduledFor, idea.scheduledTime),
          },
        });
      }
      return;
    }
    if (target === idea.scheduledFor || idea.stage === 'published') return;
    await scheduleIdea(idea.id, target, idea.scheduledTime);
    haptics.success();
    setSelected(target);
    toast({
      title: `انجدولت ${relativeDayLabel(target)}`,
      description: idea.title,
      tone: 'success',
      action: {
        label: 'تراجع',
        run: () => void scheduleIdea(idea.id, idea.scheduledFor, idea.scheduledTime),
      },
    });
  };

  const selectedItems = byDay.get(selected) ?? [];
  const headers = weekdayHeaders(settings.weekStartsOn);

  return (
    <Page wide>
      <PageHeader
        title="التقويم"
        subtitle={`${plural(inMonth.length, WORDS.post)} في ${formatDate.monthName(monthDate)}`}
        actions={
          <Button
            variant="primary"
            className="hidden md:inline-flex"
            icon={<Plus size={18} />}
            onClick={() => openCapture({ scheduledFor: selected })}
          >
            جدولة فكرة
          </Button>
        }
      />
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={onStart}
        onDragEnd={(e) => void onEnd(e)}
        onDragCancel={() => setDragging(null)}
      >
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="!p-3 sm:!p-5">
            {/* Month navigation */}
            <div className="mb-4 flex items-center gap-2 px-1">
              <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">
                {formatDate.monthYear(monthDate)}
              </h2>
              <div className="ms-auto flex items-center gap-1.5">
                <Button variant="secondary" size="sm" onClick={goToday}>
                  اليوم
                </Button>
                <IconButton
                  label="الشهر السابق"
                  variant="secondary"
                  size="sm"
                  onClick={() => shift(-1)}
                >
                  <ChevronRight size={18} />
                </IconButton>
                <IconButton
                  label="الشهر التالي"
                  variant="secondary"
                  size="sm"
                  onClick={() => shift(1)}
                >
                  <ChevronLeft size={18} />
                </IconButton>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 px-0.5 pb-2" aria-hidden>
              {headers.map((h) => (
                <span key={h.long} className="text-center text-xs font-medium text-ink-3">
                  {tablet ? h.long : h.short}
                </span>
              ))}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${cursor.y}-${cursor.m}`}
                initial={{ opacity: 0, x: dir * -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: dir * 24 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                role="grid"
                aria-label={formatDate.monthYear(monthDate)}
                className="flex flex-col gap-1.5"
              >
                {weeks.map((week) => (
                  <div key={toDayKey(week[0]!)} role="row" className="grid grid-cols-7 gap-1.5">
                    {week.map((d) => {
                      const key = toDayKey(d);
                      return (
                        <DayCell
                          key={key}
                          dayKey={key}
                          date={d}
                          items={byDay.get(key) ?? []}
                          outside={d.getMonth() !== cursor.m}
                          isToday={key === today}
                          isSelected={key === selected}
                          detailed={tablet}
                          onSelect={() => setSelected(key)}
                        />
                      );
                    })}
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>

            <div className="mt-4 flex flex-wrap items-center gap-4 px-1 text-xs text-ink-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-accent-gradient" /> منشور
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full border-2 border-accent" /> مجدول
              </span>
              <span className="hidden md:inline">سحب أي فكرة على يوم يجدولها</span>
            </div>
          </Card>

          <div className="flex flex-col gap-5">
            <DayPanel
              dayKey={selected}
              items={selectedItems}
              onAdd={() => openCapture({ scheduledFor: selected })}
            />
            <Tray ideas={unscheduled} />
          </div>
        </div>
        <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
          {dragging && (
            <div className="glass-strong flex max-w-64 rotate-[-2deg] items-center gap-2 rounded-2xl px-3 py-2.5 shadow-xl">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: STAGE_META[dragging.stage].color }}
              />
              <span className="line-clamp-1 text-sm font-medium text-ink">{dragging.title}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </Page>
  );
}

function DayCell({
  dayKey,
  date,
  items,
  outside,
  isToday,
  isSelected,
  detailed,
  onSelect,
}: {
  dayKey: string;
  date: Date;
  items: Idea[];
  outside: boolean;
  isToday: boolean;
  isSelected: boolean;
  detailed: boolean;
  onSelect: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey });
  const past = dayKey < todayKey();
  const shown = items.slice(0, 3);
  return (
    <div
      ref={setNodeRef}
      role="gridcell"
      aria-selected={isSelected}
      className={cn(
        'relative flex min-h-[3.6rem] flex-col rounded-2xl border p-1.5 text-start transition-[background-color,border-color,transform] duration-150 md:min-h-[7.4rem] md:p-2',
        isSelected
          ? 'border-accent bg-accent-softer'
          : 'border-line bg-surface hover:border-line-2',
        isOver && 'scale-[1.03] border-accent bg-accent-soft',
        outside && !isSelected && 'opacity-40',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-label={`${formatDate.full(date)}${items.length ? `، ${plural(items.length, WORDS.post)}` : ''}`}
        className="absolute inset-0 rounded-2xl"
      />
      <span
        className={cn(
          'pointer-events-none relative grid size-7 place-items-center rounded-full font-display text-sm font-semibold',
          isToday ? 'bg-accent-gradient-strong text-white' : past ? 'text-ink-3' : 'text-ink',
        )}
      >
        {date.getDate()}
      </span>
      {detailed ? (
        <div className="relative mt-1 flex min-w-0 flex-col gap-1">
          {shown.map((i) => (
            <CalendarChip key={i.id} idea={i} />
          ))}
          {items.length > 3 && (
            <span className="pointer-events-none px-1 text-[11px] text-ink-3">
              +{items.length - 3}
            </span>
          )}
        </div>
      ) : (
        items.length > 0 && (
          <span className="pointer-events-none relative mt-auto flex justify-center gap-0.5 pb-0.5">
            {items
              .slice(0, 4)
              .map((i) =>
                i.stage === 'published' ? (
                  <span key={i.id} className="size-1.5 rounded-full bg-accent-gradient" />
                ) : (
                  <span key={i.id} className="size-1.5 rounded-full border border-accent" />
                ),
              )}
          </span>
        )
      )}
    </div>
  );
}

function CalendarChip({ idea }: { idea: Idea }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `cal-${idea.id}`,
    data: { idea },
    disabled: idea.stage === 'published',
  });
  const published = idea.stage === 'published';
  return (
    <Link
      ref={setNodeRef}
      to={`/idea/${idea.id}`}
      onClick={(e) => {
        if (Date.now() - lastDragEnd < 300) e.preventDefault();
      }}
      {...attributes}
      {...listeners}
      className={cn(
        'relative z-10 flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-[11px] leading-4 font-medium transition-colors',
        published
          ? 'bg-accent-soft text-ink'
          : 'border border-line bg-solid/60 text-ink-2 hover:text-ink',
        isDragging && 'opacity-30',
      )}
      style={{ touchAction: 'manipulation' }}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: STAGE_META[idea.stage].color }}
        aria-hidden
      />
      <span className="truncate">{idea.title}</span>
    </Link>
  );
}

function DayPanel({ dayKey, items, onAdd }: { dayKey: string; items: Idea[]; onAdd: () => void }) {
  const date = fromDayKey(dayKey);
  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-ink-3">{relativeDayLabel(dayKey)}</p>
          <h2 className="font-display text-xl font-bold text-ink">{formatDate.full(date)}</h2>
        </div>
        <IconButton label="إضافة لهاليوم" variant="primary" size="sm" onClick={onAdd}>
          <Plus size={18} />
        </IconButton>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line py-8 text-center">
          <CalendarCheck2 size={26} className="mb-2 text-ink-3" />
          <p className="text-sm text-ink-3">يوم فاضي</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((i) => (
            <li key={i.id}>
              <Link
                to={`/idea/${i.id}`}
                className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition-colors hover:border-line-2 hover:bg-surface-2"
              >
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-lg"
                  aria-hidden
                >
                  {FORMAT_META[i.format].emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-sm font-semibold text-ink">{i.title}</span>
                  <span className="mt-1 flex items-center gap-2">
                    <StageBadge stage={i.stage} />
                    {i.scheduledTime && (
                      <span className="num text-xs text-ink-3">
                        {formatTimeKey(i.scheduledTime)}
                      </span>
                    )}
                  </span>
                </span>
                <PlatformStack ids={i.platforms} size={20} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Tray({ ideas }: { ideas: Idea[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'tray' });
  return (
    <Card className={cn('transition-colors', isOver && 'border-accent bg-accent-softer')}>
      <div ref={setNodeRef}>
        <div className="mb-3 flex items-center gap-2">
          <Inbox size={18} className="text-ink-3" />
          <h2 className="font-display text-base font-semibold text-ink">بدون موعد</h2>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-3">
            {ideas.length}
          </span>
        </div>
        <p className="mb-3 text-xs text-ink-3">سحب أي فكرة لليوم المناسب يجدولها</p>
        {ideas.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-3">كل الأفكار لها موعد 👌</p>
        ) : (
          <ul className="no-scrollbar flex max-h-[420px] flex-col gap-1.5 overflow-y-auto">
            {ideas.map((i) => (
              <TrayItem key={i.id} idea={i} />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function TrayItem({ idea }: { idea: Idea }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tray-${idea.id}`,
    data: { idea },
  });
  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`سحب «${idea.title}» للتقويم`}
      className={cn(
        'flex cursor-grab items-center gap-2 rounded-xl border border-line bg-surface px-2.5 py-2 transition-colors hover:border-line-2 active:cursor-grabbing',
        isDragging && 'opacity-30',
      )}
      style={{ touchAction: 'manipulation' }}
    >
      <GripVertical size={15} className="shrink-0 text-ink-3" />
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ background: STAGE_META[idea.stage].color }}
        aria-hidden
      />
      <span className="line-clamp-1 flex-1 text-sm text-ink">{idea.title}</span>
    </li>
  );
}
