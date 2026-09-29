import { useState } from 'react';
import { formatDate, fromDayKey } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { plural, WORDS } from '@/lib/format';

/* Activity heatmap: one hue, faint → strong, five steps. Columns are weeks,
   oldest on the left and this week on the right; rows are weekdays. */

const LEVELS = [0, 1, 3, 5, 8];

function level(count: number): number {
  let l = 0;
  LEVELS.forEach((t, i) => {
    if (count >= t && t > 0) l = i;
  });
  return l;
}

const FILL = [
  'var(--surface-3)',
  'color-mix(in oklab, var(--accent) 30%, transparent)',
  'color-mix(in oklab, var(--accent) 55%, transparent)',
  'color-mix(in oklab, var(--accent) 80%, transparent)',
  'var(--accent)',
];

export function Heatmap({ weeks }: { weeks: { day: string; count: number; future: boolean }[][] }) {
  const [hover, setHover] = useState<{ day: string; count: number } | null>(null);
  return (
    <div>
      <div
        dir="ltr"
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
        role="img"
        aria-label="خريطة النشاط لآخر الأسابيع"
        onPointerLeave={() => setHover(null)}
      >
        {weeks.map((week) => (
          <div key={week[0]?.day} className="grid grid-rows-7 gap-[3px]">
            {week.map((c) => (
              <span
                key={c.day}
                onPointerEnter={() => !c.future && setHover(c)}
                className={cn(
                  'aspect-square rounded-[5px] transition-transform',
                  !c.future && 'hover:scale-125',
                  c.future && 'opacity-0',
                )}
                style={{ background: FILL[level(c.count)] }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-ink-3">
        <span className="min-h-4">
          {hover ? (
            <>
              {formatDate.full(fromDayKey(hover.day))} ·{' '}
              <span className="text-ink-2">
                {hover.count === 0 ? 'بدون نشاط' : plural(hover.count, WORDS.step)}
              </span>
            </>
          ) : (
            'تفاصيل كل يوم تطلع عند المرور على مربعه'
          )}
        </span>
        <span className="flex items-center gap-1.5">
          أقل
          {FILL.map((f, i) => (
            <span key={i} className="size-3 rounded-[3px]" style={{ background: f }} />
          ))}
          أكثر
        </span>
      </div>
    </div>
  );
}
