import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { STAGE_ICONS } from '@/components/ui/StageBadge';
import { STAGE_META } from '@/lib/catalog';
import { cn } from '@/lib/cn';
import { STAGES, type Idea, type Stage } from '@/lib/types';
import { useUI } from '@/store/ui';
import { IdeaCard } from './IdeaCard';
import { useIdeaActions } from './useIdeaActions';

/* Kanban board: drag a card to another column to move it through production.
   Mouse, touch (long-press) and keyboard (space + arrows) all work. */

let lastDragEnd = 0;
const swallowClickAfterDrag = (e: React.MouseEvent) => {
  if (Date.now() - lastDragEnd < 300) e.preventDefault();
};

const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

function DraggableCard({ idea }: { idea: Idea }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: idea.id,
    data: { idea },
  });
  return (
    <IdeaCard
      idea={idea}
      compact
      dragRef={setNodeRef}
      dragProps={
        {
          ...attributes,
          ...listeners,
          'aria-roledescription': 'بطاقة قابلة للسحب',
        } as React.HTMLAttributes<HTMLDivElement>
      }
      dragging={isDragging}
      onLinkClick={swallowClickAfterDrag}
      style={{ touchAction: 'manipulation' }}
    />
  );
}

function Column({ stage, ideas, focused }: { stage: Stage; ideas: Idea[]; focused: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const openCapture = useUI((s) => s.openCapture);
  const meta = STAGE_META[stage];
  const Icon = STAGE_ICONS[stage];
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (focused)
      ref.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [focused]);

  return (
    <section
      ref={ref}
      aria-label={`${meta.label}: ${ideas.length}`}
      className="flex w-[80vw] max-w-[300px] shrink-0 snap-center flex-col md:w-[272px]"
    >
      <header className="mb-3 flex items-center gap-2.5 px-1">
        <span
          className="grid size-8 place-items-center rounded-[10px]"
          style={{
            background: `color-mix(in oklab, ${meta.color} 18%, transparent)`,
            color: meta.color,
          }}
        >
          <Icon size={16} />
        </span>
        <h2 className="font-display text-[15px] font-semibold text-ink">{meta.label}</h2>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-3">
          {ideas.length}
        </span>
        <button
          type="button"
          aria-label={`فكرة جديدة في «${meta.label}»`}
          onClick={() => openCapture({ stage })}
          className="ms-auto grid size-8 place-items-center rounded-xl text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Plus size={17} />
        </button>
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[55dvh] flex-1 flex-col gap-2.5 rounded-[22px] border border-dashed p-2.5 transition-[background-color,border-color] duration-200',
          isOver
            ? 'border-accent bg-accent-softer'
            : focused
              ? 'border-line-2 bg-surface'
              : 'border-transparent bg-surface/60',
        )}
      >
        {ideas.map((i) => (
          <DraggableCard key={i.id} idea={i} />
        ))}
        {ideas.length === 0 && (
          <p className="grid flex-1 place-items-center rounded-2xl px-4 py-10 text-center text-sm text-ink-3">
            {isOver ? 'أفلتها هنا' : 'فاضي'}
          </p>
        )}
      </div>
    </section>
  );
}

export function Board({ ideas, focus }: { ideas: Idea[]; focus: Stage | null }) {
  const { moveTo } = useIdeaActions();
  const [active, setActive] = useState<Idea | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const onStart = (e: DragStartEvent) => {
    setActive((e.active.data.current?.idea as Idea | undefined) ?? null);
    navigator.vibrate?.(10);
  };

  const onEnd = (e: DragEndEvent) => {
    lastDragEnd = Date.now();
    const idea = e.active.data.current?.idea as Idea | undefined;
    const target = e.over?.id as Stage | undefined;
    setActive(null);
    if (idea && target && STAGES.includes(target) && target !== idea.stage)
      void moveTo(idea, target);
  };

  const byStage = (s: Stage) =>
    ideas
      .filter((i) => i.stage === s)
      .sort((a, b) => {
        if (a.scheduledFor && b.scheduledFor) return a.scheduledFor.localeCompare(b.scheduledFor);
        if (a.scheduledFor) return -1;
        if (b.scheduledFor) return 1;
        return b.updatedAt - a.updatedAt;
      });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onStart}
      onDragEnd={onEnd}
      onDragCancel={() => setActive(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable: 'للسحب اضغط مسافة، وحرّك بالأسهم، ثم مسافة للإفلات أو Esc للإلغاء',
        },
        announcements: {
          onDragStart: () => 'بدأ السحب',
          onDragOver: ({ over }) =>
            over ? `فوق «${STAGE_META[over.id as Stage]?.label ?? ''}»` : '',
          onDragEnd: ({ over }) =>
            over ? `انتقلت إلى «${STAGE_META[over.id as Stage]?.label ?? ''}»` : 'انلغى السحب',
          onDragCancel: () => 'انلغى السحب',
        },
      }}
    >
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 md:-mx-8 md:snap-none md:px-8">
        {STAGES.map((s) => (
          <Column key={s} stage={s} ideas={byStage(s)} focused={focus === s} />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
        {active && <IdeaCard idea={active} compact overlay />}
      </DragOverlay>
    </DndContext>
  );
}
